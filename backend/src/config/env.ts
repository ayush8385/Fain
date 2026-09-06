import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? "",
  gmailClientId: process.env.GMAIL_CLIENT_ID ?? "",
  gmailClientSecret: process.env.GMAIL_CLIENT_SECRET ?? "",
  gmailRedirectUri: process.env.GMAIL_REDIRECT_URI ?? "",
  sessionJwtSecret: process.env.SESSION_JWT_SECRET ?? "",
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  // JSON string of a Firebase service account key — enables FCM push notifications.
  // Leave unset to run without push (notifications are silently skipped).
  fcmServiceAccountJson: process.env.FCM_SERVICE_ACCOUNT_JSON ?? "",
};

const required: Array<keyof typeof env> = [
  "gmailClientId",
  "gmailClientSecret",
  "gmailRedirectUri",
  "sessionJwtSecret",
];

for (const key of required) {
  if (!env[key]) {
    console.warn(`[env] Missing ${key} — Google OAuth routes will fail until it is set.`);
  }
}
