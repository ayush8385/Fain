import { prisma } from "../db/prisma";
import { listTransactionCandidates } from "./gmailClient";

/**
 * Fetches candidate transaction emails for a single user and stages any not
 * already seen into IngestedEmail. Dedup key is (userId, gmailMessageId).
 * Returns the count of newly staged emails.
 */
export async function pollUserInbox(userId: string): Promise<number> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!user.gmailRefreshToken) {
    throw new Error(`User ${userId} has not connected Gmail`);
  }

  const candidates = await listTransactionCandidates(user.gmailRefreshToken, user.createdAt);

  const result = await prisma.ingestedEmail.createMany({
    data: candidates.map((candidate) => ({
      userId,
      gmailMessageId: candidate.gmailMessageId,
      subject: candidate.subject,
      fromAddress: candidate.fromAddress,
      receivedAt: candidate.receivedAt,
      status: "pending_parse",
    })),
    skipDuplicates: true, // relies on the (userId, gmailMessageId) unique constraint for dedup
  });

  return result.count;
}
