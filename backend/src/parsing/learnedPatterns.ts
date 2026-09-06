import RE2 from "re2";
import { prisma } from "../db/prisma";
import { EmailPayload, ParsedTransaction } from "./templates/types";
import { validateParsedFields } from "./validation";
import { CandidatePattern } from "./llmFallback";

// A pattern is auto-disabled once it has failed at least as often as it has
// succeeded — bounds the damage of one bad learned pattern without requiring
// a manual review step, since global reuse starts immediately on first success.
function shouldDisable(successCount: number, failureCount: number): boolean {
  return failureCount >= successCount;
}

type ApplyResult =
  | { outcome: "matched"; parsed: ParsedTransaction }
  | { outcome: "no-match" }
  | { outcome: "invalid" };

// Distinguishes "this pattern simply doesn't apply to this email" (expected —
// a sender can have multiple formats, so a non-match isn't evidence the
// pattern is bad) from "this pattern matched but produced garbage" (a real
// failure, since the regex was supposed to be reliable for this sender).
function applyPattern(
  pattern: { regex: string; flags: string; groupOrder: unknown; fixedCurrency: string | null; fixedDirection: string | null },
  bodyText: string,
): ApplyResult {
  const groupOrder = Array.isArray(pattern.groupOrder)
    ? pattern.groupOrder.filter((g): g is string => typeof g === "string")
    : [];
  if (groupOrder.length === 0) return { outcome: "invalid" };

  const match = new RE2(pattern.regex, pattern.flags).exec(bodyText);
  if (!match) return { outcome: "no-match" };

  // Same group-count guard as the candidate-pattern check in llmFallback.ts —
  // stored patterns should already satisfy this, but a stray mismatch here
  // would silently shift every field, so treat it as a real match-time failure
  // rather than an "invalid pattern shape" that's excused as no-match.
  if (match.length - 1 !== groupOrder.length) return { outcome: "invalid" };

  const reconstructed: Record<string, unknown> = {};
  groupOrder.forEach((field, i) => {
    reconstructed[field] = match[i + 1];
  });
  if (reconstructed.date) {
    reconstructed.transactionDate = reconstructed.time
      ? `${reconstructed.date} ${reconstructed.time}`
      : reconstructed.date;
  }
  if (pattern.fixedCurrency && !reconstructed.currency) {
    reconstructed.currency = pattern.fixedCurrency;
  }
  if (pattern.fixedDirection && !reconstructed.direction) {
    reconstructed.direction = pattern.fixedDirection;
  }

  const parsed = validateParsedFields(reconstructed);
  return parsed ? { outcome: "matched", parsed } : { outcome: "invalid" };
}

/**
 * Third parsing tier, tried between the rule engine and the LLM fallback.
 * Looks up globally-learned, sender-keyed patterns (originally authored by the
 * LLM on a prior unrecognized email) and applies them via RE2 — a linear-time
 * regex engine with no catastrophic-backtracking risk, since these patterns
 * are LLM-authored rather than human-reviewed.
 */
export async function tryParseWithLearnedPattern(email: EmailPayload): Promise<ParsedTransaction | null> {
  const senderAddress = email.fromAddress.trim().toLowerCase();
  const patterns = await prisma.learnedEmailPattern.findMany({
    where: { senderAddress, disabled: false },
    orderBy: { successCount: "desc" },
  });

  for (const pattern of patterns) {
    let result: ApplyResult;
    try {
      result = applyPattern(pattern, email.bodyText);
    } catch (error) {
      console.error(`[learnedPatterns] pattern ${pattern.id} threw:`, error);
      result = { outcome: "invalid" };
    }

    if (result.outcome === "no-match") continue;

    if (result.outcome === "matched") {
      await prisma.learnedEmailPattern.update({
        where: { id: pattern.id },
        data: { successCount: { increment: 1 }, lastUsedAt: new Date() },
      });
      return result.parsed;
    }

    const failureCount = pattern.failureCount + 1;
    await prisma.learnedEmailPattern.update({
      where: { id: pattern.id },
      data: {
        failureCount: { increment: 1 },
        disabled: shouldDisable(pattern.successCount, failureCount),
      },
    });
  }

  return null;
}

/**
 * Persists a candidate pattern proposed by the LLM fallback after a
 * successful extraction, so future emails from the same sender/format skip
 * the LLM. The candidate has already been self-consistency-checked (its
 * regex reproduces the LLM's own extracted values) before reaching here.
 */
export async function recordLearnedPattern(
  email: EmailPayload,
  candidate: CandidatePattern,
  fixedCurrency?: string,
  fixedDirection?: string,
): Promise<void> {
  const senderAddress = email.fromAddress.trim().toLowerCase();

  const existing = await prisma.learnedEmailPattern.findUnique({
    where: { senderAddress_regex: { senderAddress, regex: candidate.regex } },
  });

  if (existing) {
    await prisma.learnedEmailPattern.update({
      where: { id: existing.id },
      data: { successCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    return;
  }

  await prisma.learnedEmailPattern.create({
    data: {
      senderAddress,
      regex: candidate.regex,
      groupOrder: candidate.groupOrder,
      fixedCurrency,
      fixedDirection,
      sampleSubject: email.subject,
    },
  });
}
