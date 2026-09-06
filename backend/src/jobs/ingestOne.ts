import { prisma } from "../db/prisma";
import { getEmailContent } from "../ingestion/gmailClient";
import { tryParseWithRules } from "../parsing/ruleEngine";
import { tryParseWithLLM } from "../parsing/llmFallback";
import { tryParseWithLearnedPattern, recordLearnedPattern } from "../parsing/learnedPatterns";
import { CandidatePattern } from "../parsing/llmFallback";
import { EmailPayload, ParsedTransaction } from "../parsing/templates/types";
import { categorizeMerchant } from "../categorization/categorizer";
import { sendCategorizationPrompt } from "../notifications/pushService";

export type IngestOneResult = "created" | "duplicate" | "unparseable";

/**
 * Runs a single staged email through parsing and creates a Transaction if
 * successful. Categorization is deferred to Phase 3 — every created
 * Transaction is left as "needs_review" with no category.
 */
export async function ingestOne(userId: string, gmailMessageId: string): Promise<IngestOneResult> {
  const existing = await prisma.transaction.findUnique({
    where: { userId_sourceRef: { userId, sourceRef: gmailMessageId } },
  });
  if (existing) {
    await markIngestedStatus(userId, gmailMessageId, "parsed");
    return "duplicate";
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!user.gmailRefreshToken) {
    throw new Error(`User ${userId} has not connected Gmail`);
  }

  const email = await getEmailContent(user.gmailRefreshToken, gmailMessageId);

  let parsed: ParsedTransaction | null = tryParseWithRules(email);
  let extractionMethod: "rule" | "learned" | "llm" = "rule";

  if (!parsed) {
    parsed = await tryParseWithLearnedPattern(email);
    extractionMethod = "learned";
  }

  if (!parsed) {
    const llmResult = await tryParseWithLLM(email);
    extractionMethod = "llm";
    parsed = llmResult?.parsed ?? null;

    if (llmResult?.candidatePattern) {
      await recordCandidatePattern(email, llmResult.candidatePattern);
    }
  }

  if (!parsed) {
    await markIngestedStatus(userId, gmailMessageId, "unparseable");
    return "unparseable";
  }

  const merchantNormalized = parsed.merchantRaw.trim().toLowerCase();
  const categorization = await categorizeMerchant(userId, merchantNormalized);

  const transaction = await prisma.transaction.create({
    data: {
      userId,
      amount: parsed.amount,
      currency: parsed.currency,
      direction: parsed.direction,
      merchantRaw: parsed.merchantRaw,
      merchantNormalized,
      transactionDate: parsed.transactionDate,
      accountLast4: parsed.accountLast4,
      sourceType: "email",
      sourceRef: gmailMessageId,
      extractionMethod,
      categoryId: categorization?.categoryId ?? null,
      categoryConfidence: categorization?.confidence ?? null,
      status: categorization ? "auto_categorized" : "needs_review",
    },
  });

  await markIngestedStatus(userId, gmailMessageId, "parsed");

  if (transaction.status === "needs_review") {
    sendCategorizationPrompt(userId, transaction).catch((error) => {
      console.error("[ingestOne] push notification failed:", error);
    });
  }

  return "created";
}

// Failing to persist a learned pattern should never fail the ingestion of the
// transaction that already succeeded — recorded best-effort, logged on error.
async function recordCandidatePattern(email: EmailPayload, candidate: CandidatePattern): Promise<void> {
  try {
    await recordLearnedPattern(email, candidate);
  } catch (error) {
    console.error("[ingestOne] failed to record learned pattern:", error);
  }
}

async function markIngestedStatus(userId: string, gmailMessageId: string, status: string) {
  await prisma.ingestedEmail.updateMany({
    where: { userId, gmailMessageId },
    data: { status },
  });
}
