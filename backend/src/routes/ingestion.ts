import { Router } from "express";
import { AuthenticatedRequest, requireAuth } from "../auth/session";
import { pollUserInbox } from "../ingestion/poller";
import { prisma } from "../db/prisma";
import { ingestOne } from "../jobs/ingestOne";

export const ingestionRouter = Router();

// Manual trigger for local testing. Phase 1 outcome is "emails are fetched and
// staged" — a cron/Pub/Sub trigger replaces this manual call in a later phase.
ingestionRouter.post("/ingestion/poll", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const stagedCount = await pollUserInbox(req.userId!);
    res.json({ stagedCount });
  } catch (error) {
    console.error("[ingestion] poll failed:", error);
    res.status(500).json({ error: "Failed to poll inbox" });
  }
});

// Manual trigger for local testing. Runs ingestOne over every staged email still
// pending parse for this user. A queue/worker replaces this manual call later.
ingestionRouter.post("/ingestion/parse", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const pending = await prisma.ingestedEmail.findMany({
      where: { userId: req.userId!, status: "pending_parse" },
      select: { gmailMessageId: true },
    });

    const summary = { created: 0, duplicate: 0, unparseable: 0, failed: 0 };
    for (const { gmailMessageId } of pending) {
      try {
        const result = await ingestOne(req.userId!, gmailMessageId);
        summary[result]++;
      } catch (error) {
        console.error(`[ingestion] failed to parse ${gmailMessageId}:`, error);
        summary.failed++;
      }
    }

    res.json({ processed: pending.length, ...summary });
  } catch (error) {
    console.error("[ingestion] parse failed:", error);
    res.status(500).json({ error: "Failed to parse staged emails" });
  }
});
