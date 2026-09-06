import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import RE2 from "re2";
import { env } from "../config/env";
import { EmailPayload, ParsedTransaction } from "./templates/types";
import { validateParsedFields } from "./validation";

export interface CandidatePattern {
  regex: string;
  groupOrder: string[];
}

export interface LLMExtractionResult {
  parsed: ParsedTransaction;
  candidatePattern: CandidatePattern | null;
}

// Pin to the real Anthropic API explicitly. Without this, the SDK picks up
// ANTHROPIC_BASE_URL/ANTHROPIC_AUTH_TOKEN from the shell environment (set by
// Claude Code's own corporate gateway config) and silently routes requests
// there instead of using env.anthropicApiKey.
const anthropic = env.anthropicApiKey
  ? new Anthropic({ apiKey: env.anthropicApiKey, baseURL: "https://api.anthropic.com", authToken: null })
  : null;

const openai = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

const EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    isTransaction: {
      type: "boolean",
      description:
        "true only if this email confirms money was actually debited or credited (a completed transaction). false for balance updates, statements, promotions, loan offers, OTPs, or anything else that isn't a completed transaction.",
    },
    amount: { type: "number", description: "Transaction amount, numeric only." },
    currency: { type: "string", description: "ISO currency code, e.g. INR, USD." },
    direction: { type: "string", enum: ["debit", "credit"] },
    merchantRaw: {
      type: "string",
      description: "Merchant, payee, or counterparty name as it appears in the email.",
    },
    transactionDate: {
      type: "string",
      description: "ISO 8601 date-time of the transaction, best effort from the email content.",
    },
    accountLast4: {
      type: "string",
      description: "Last 4 digits of the account or card involved, if present.",
    },
    extractionRegex: {
      type: "string",
      description:
        "Only if isTransaction is true: a regular expression, written against the exact body text given, whose capture groups would extract the same field values from this email and from other emails of the identical format/layout from this same sender. The Nth capturing group (by order of opening parenthesis) must correspond exactly to the Nth entry in extractionGroupOrder — use non-capturing groups (?:...) for any alternation, optional segments, or other grouping that is NOT itself one of the extracted fields. This will run on the RE2 engine, which does NOT support lookahead (?=...), lookbehind (?<=...), or backreferences (\\1) — use only literal text, character classes, quantifiers, and non-capturing/capturing groups. Omit if no reliable general pattern exists.",
    },
    extractionGroupOrder: {
      type: "array",
      items: { type: "string", enum: ["amount", "currency", "direction", "merchantRaw", "date", "time", "accountLast4"] },
      description:
        "Only if extractionRegex is set: the field name each capture group in extractionRegex corresponds to, in order.",
    },
  },
  required: ["isTransaction"],
};

function buildPrompt(email: EmailPayload): string {
  return `Analyze this email and report whether it is a completed bank transaction, extracting details if so. If it is a transaction, also propose a general-purpose regular expression (extractionRegex + extractionGroupOrder) that would extract the same fields from the exact body text below and from other emails of this same sender's format.\n\nFrom: ${email.fromAddress}\nSubject: ${email.subject}\n\nBody:\n${email.bodyText.slice(0, 4000)}`;
}

function toExtractionResult(
  result: Record<string, unknown>,
  bodyText: string,
): LLMExtractionResult | null {
  if (!result.isTransaction) return null;

  const parsed = validateParsedFields(result);
  if (!parsed) return null;

  const candidatePattern = buildCandidatePattern(result, bodyText, parsed);
  return { parsed, candidatePattern };
}

// Self-consistency check: only surfaces the LLM's proposed regex as a
// candidate pattern if re-running it (via RE2, the same safe engine used for
// all future applications of learned patterns) against the same body text
// reproduces the LLM's own directly-extracted values. An unverifiable or
// inconsistent regex is discarded here rather than persisted.
function buildCandidatePattern(
  result: Record<string, unknown>,
  bodyText: string,
  parsed: ParsedTransaction,
): CandidatePattern | null {
  const regex = typeof result.extractionRegex === "string" ? result.extractionRegex : null;
  const groupOrder = Array.isArray(result.extractionGroupOrder)
    ? result.extractionGroupOrder.filter((g): g is string => typeof g === "string")
    : null;
  if (!regex || !groupOrder || groupOrder.length === 0) return null;

  let reValidated: ParsedTransaction | null;
  try {
    const match = new RE2(regex, "is").exec(bodyText);
    if (!match) return null;

    // Guard against nested/extra capturing groups (e.g. alternation or optional
    // segments the LLM wrote as `(...)` instead of `(?:...)`), which would
    // silently shift every group after them out of alignment with groupOrder.
    // match.length includes match[0] (the full match), so groups captured is
    // match.length - 1.
    if (match.length - 1 !== groupOrder.length) return null;

    const reconstructed: Record<string, unknown> = {};
    groupOrder.forEach((field, i) => {
      reconstructed[field] = match[i + 1];
    });
    if (reconstructed.date) {
      reconstructed.transactionDate = reconstructed.time
        ? `${reconstructed.date} ${reconstructed.time}`
        : reconstructed.date;
    }
    reValidated = validateParsedFields(reconstructed);
  } catch {
    return null;
  }
  if (!reValidated) return null;

  // accountLast4 is optional on both sides — only treated as inconsistent if
  // the regex captured a value that actively disagrees with direct extraction,
  // not merely because the regex didn't bother capturing it at all.
  const accountLast4Consistent =
    !reValidated.accountLast4 || !parsed.accountLast4 || reValidated.accountLast4 === parsed.accountLast4;

  const matches =
    reValidated.amount === parsed.amount &&
    reValidated.currency === parsed.currency &&
    reValidated.direction === parsed.direction &&
    reValidated.merchantRaw === parsed.merchantRaw &&
    accountLast4Consistent;
  if (!matches) return null;

  return { regex, groupOrder };
}

async function tryOpenAI(email: EmailPayload): Promise<LLMExtractionResult | null> {
  if (!openai) return null;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: buildPrompt(email) }],
    tools: [
      {
        type: "function",
        function: {
          name: "report_transaction",
          description: "Report whether the email describes a completed bank/card transaction.",
          parameters: EXTRACTION_SCHEMA,
        },
      },
    ],
    tool_choice: { type: "function", function: { name: "report_transaction" } },
  });

  const toolCall = response.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.type !== "function") return null;

  const result = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  return toExtractionResult(result, email.bodyText);
}

async function tryAnthropic(email: EmailPayload): Promise<LLMExtractionResult | null> {
  if (!anthropic) return null;

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 512,
    tools: [
      {
        name: "report_transaction",
        description: "Report whether the email describes a completed bank/card transaction.",
        input_schema: EXTRACTION_SCHEMA as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: "report_transaction" },
    messages: [{ role: "user", content: buildPrompt(email) }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  if (!toolUse) return null;

  return toExtractionResult(toolUse.input as Record<string, unknown>, email.bodyText);
}

/**
 * Fallback for emails no rule template matched. Asks an LLM to both classify
 * ("is this even a transaction email?") and extract fields in one call, so
 * unrecognized bank formats/domains are handled without hardcoding new
 * keywords or senders into the ingestion query or rule engine.
 *
 * Tries OpenAI first (if configured), then Anthropic. Either provider failing
 * (billing, network, API error) fails soft — the caller treats a null return
 * as "unparseable" rather than aborting the whole ingestion batch.
 */
export async function tryParseWithLLM(email: EmailPayload): Promise<LLMExtractionResult | null> {
  if (!openai && !anthropic) {
    console.warn("[llmFallback] No LLM provider configured (OPENAI_API_KEY / ANTHROPIC_API_KEY) — skipping");
    return null;
  }

  try {
    if (openai) return await tryOpenAI(email);
    return await tryAnthropic(email);
  } catch (error) {
    console.error("[llmFallback] LLM extraction failed:", error);
    return null;
  }
}
