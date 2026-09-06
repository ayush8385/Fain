import { prisma } from "../db/prisma";
import { Transaction } from "@prisma/client";
import { buildCategorizationPrompt } from "./templates";
import { env } from "../config/env";

// Lazy-initialise the Firebase Admin app only when FCM credentials are present.
// Importing firebase-admin unconditionally is fine — it's a no-op until getApp()
// or initializeApp() is called.
let fcmInitialised = false;

function getFcmApp() {
  if (fcmInitialised) {
    const admin = require("firebase-admin");
    return admin.app();
  }

  if (!env.fcmServiceAccountJson) {
    return null;
  }

  try {
    const admin = require("firebase-admin");
    const serviceAccount = JSON.parse(env.fcmServiceAccountJson);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    fcmInitialised = true;
    return admin.app();
  } catch (error) {
    console.error("[pushService] Failed to init Firebase Admin:", error);
    return null;
  }
}

async function sendFcm(token: string, payload: ReturnType<typeof buildCategorizationPrompt>): Promise<void> {
  const app = getFcmApp();
  if (!app) return;

  const admin = require("firebase-admin");
  await admin.messaging(app).send({
    token,
    notification: { title: payload.title, body: payload.body },
    data: payload.data,
    android: {
      priority: "high",
      notification: { channelId: "transactions" },
    },
    apns: {
      payload: {
        aps: {
          alert: { title: payload.title, body: payload.body },
          sound: "default",
          badge: 1,
          category: "CATEGORIZE_TRANSACTION",
        },
      },
    },
  });
}

/**
 * Sends a categorization prompt push notification to all of the user's
 * registered devices. Fires best-effort — a failure to send never blocks
 * the transaction from being stored.
 */
export async function sendCategorizationPrompt(userId: string, transaction: Transaction): Promise<void> {
  const tokens = await prisma.deviceToken.findMany({ where: { userId } });
  if (tokens.length === 0) return;

  const payload = buildCategorizationPrompt(transaction);

  await Promise.allSettled(
    tokens.map(async (dt) => {
      try {
        await sendFcm(dt.token, payload);
      } catch (error) {
        console.error(`[pushService] Failed to send to token ${dt.id}:`, error);
        // If FCM reports the token as invalid/unregistered, remove it.
        const msg = String((error as any)?.errorInfo?.code ?? "");
        if (msg.includes("registration-token-not-registered") || msg.includes("invalid-registration-token")) {
          await prisma.deviceToken.delete({ where: { id: dt.id } }).catch(() => {});
        }
      }
    }),
  );
}
