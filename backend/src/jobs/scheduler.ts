import { prisma } from "../db/prisma";
import { pollUserInbox } from "../ingestion/poller";
import { ingestOne } from "./ingestOne";
import { watchUserInbox } from "../ingestion/gmailClient";

// Pub/Sub push notifications handle real-time delivery. This scheduler is a
// daily fallback to catch any emails missed during watch downtime, plus it
// renews Gmail watches before they expire (7-day limit).
const POLL_INTERVAL_MS = 24 * 60 * 60 * 1000; // once per day
const WATCH_RENEW_BUFFER_MS = 12 * 60 * 60 * 1000; // renew when < 12h left

async function renewWatchesIfNeeded() {
  const renewBefore = new Date(Date.now() + WATCH_RENEW_BUFFER_MS);
  const users = await prisma.user.findMany({
    where: {
      gmailRefreshToken: { not: null },
      OR: [
        { gmailWatchExpiry: null },
        { gmailWatchExpiry: { lte: renewBefore } },
      ],
    },
    select: { id: true, email: true, gmailRefreshToken: true },
  });

  for (const user of users) {
    try {
      const expiry = await watchUserInbox(user.gmailRefreshToken!);
      await prisma.user.update({ where: { id: user.id }, data: { gmailWatchExpiry: expiry } });
      console.log(`[scheduler] renewed Gmail watch for ${user.email}, expires ${expiry.toISOString()}`);
    } catch (err) {
      console.error(`[scheduler] watch renewal failed for ${user.email}:`, err);
    }
  }
}

async function runForAllUsers() {
  const users = await prisma.user.findMany({
    where: { gmailRefreshToken: { not: null } },
    select: { id: true, email: true },
  });

  if (users.length === 0) return;

  console.log(`[scheduler] polling ${users.length} user(s)`);

  for (const user of users) {
    try {
      const staged = await pollUserInbox(user.id);
      if (staged === 0) continue;

      console.log(`[scheduler] ${user.email}: staged ${staged} new email(s)`);

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
          console.error(`[scheduler] failed to ingest ${gmailMessageId}:`, err);
          summary.failed++;
        }
      }

      console.log(`[scheduler] ${user.email}:`, summary);
    } catch (err) {
      console.error(`[scheduler] failed for user ${user.email}:`, err);
    }
  }
}

export function startScheduler() {
  console.log("[scheduler] starting — daily fallback poll + watch renewal");

  // Renew any near-expiry Gmail watches immediately on startup.
  renewWatchesIfNeeded().catch((err) => console.error("[scheduler] initial watch renewal failed:", err));

  // Daily fallback: catches any emails missed while watch was down.
  runForAllUsers().catch((err) => console.error("[scheduler] initial run failed:", err));

  setInterval(() => {
    renewWatchesIfNeeded().catch((err) => console.error("[scheduler] watch renewal failed:", err));
    runForAllUsers().catch((err) => console.error("[scheduler] poll failed:", err));
  }, POLL_INTERVAL_MS);
}
