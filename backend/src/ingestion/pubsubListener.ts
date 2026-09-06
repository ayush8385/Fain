import { Router } from "express";
import { prisma } from "../db/prisma";
import { pollUserInbox } from "./poller";
import { ingestOne } from "../jobs/ingestOne";

export const pubsubRouter = Router();

/**
 * Google Cloud Pub/Sub push endpoint. Gmail calls this whenever a new message
 * arrives in a watched inbox. The notification payload only tells us *that*
 * something changed — we still call the Gmail API to find and fetch the new
 * email(s), the same pipeline as the scheduled poller.
 *
 * Pub/Sub expects a 2xx response within the ack-deadline (30s). Any non-2xx
 * causes a retry, so we ack immediately and process async to avoid timeouts
 * on large mailboxes.
 */
pubsubRouter.post("/pubsub/gmail", async (req, res) => {
  // Ack immediately — processing happens after the response is sent.
  res.sendStatus(204);

  try {
    const message = req.body?.message;
    if (!message?.data) return;

    const decoded = JSON.parse(Buffer.from(message.data, "base64").toString("utf8"));
    const gmailAddress = decoded.emailAddress as string | undefined;
    if (!gmailAddress) return;

    const user = await prisma.user.findUnique({
      where: { email: gmailAddress },
      select: { id: true, email: true, gmailRefreshToken: true },
    });
    if (!user?.gmailRefreshToken) return;

    console.log(`[pubsub] notification for ${user.email} — polling inbox`);

    const staged = await pollUserInbox(user.id);
    if (staged === 0) return;

    console.log(`[pubsub] ${user.email}: staged ${staged} new email(s), parsing`);

    const pending = await prisma.ingestedEmail.findMany({
      where: { userId: user.id, status: "pending_parse" },
      select: { gmailMessageId: true },
    });

    const summary = { created: 0, duplicate: 0, unparseable: 0, failed: 0 };
    for (const { gmailMessageId } of pending) {
      try {
        const result = await ingestOne(user.id, gmailMessageId);
        summary[result]++;
      } catch (err) {
        console.error(`[pubsub] failed to ingest ${gmailMessageId}:`, err);
        summary.failed++;
      }
    }

    console.log(`[pubsub] ${user.email}:`, summary);
  } catch (err) {
    console.error("[pubsub] handler error:", err);
  }
});
