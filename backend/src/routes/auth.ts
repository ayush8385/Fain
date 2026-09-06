import { Router } from "express";
import { exchangeCodeForTokens, getConsentUrl, getGmailProfileEmail } from "../auth/googleOAuth";
import { encryptToken } from "../auth/tokenCrypto";
import { issueSessionToken } from "../auth/session";
import { prisma } from "../db/prisma";
import { seedUserDefaults } from "../categorization/seedDefaults";
import { watchUserInbox } from "../ingestion/gmailClient";

export const authRouter = Router();

authRouter.get("/auth/google/url", (_req, res) => {
  res.json({ url: getConsentUrl() });
});

authRouter.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;

  if (typeof code !== "string") {
    res.status(400).json({ error: "Missing 'code' query parameter" });
    return;
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const email = await getGmailProfileEmail(tokens.access_token!);

    const user = await prisma.user.upsert({
      where: { email },
      update: { gmailRefreshToken: encryptToken(tokens.refresh_token!) },
      create: {
        email,
        gmailRefreshToken: encryptToken(tokens.refresh_token!),
      },
    });

    await seedUserDefaults(user.id);

    // Register Gmail push-notification watch so Pub/Sub delivers real-time inbox events.
    // Non-fatal: if watch fails (quota, permissions) we still complete login and fall
    // back to the daily scheduler poll.
    try {
      // user.gmailRefreshToken is the encrypted token stored in the DB — pass it as-is.
      const watchExpiry = await watchUserInbox(user.gmailRefreshToken!);
      await prisma.user.update({
        where: { id: user.id },
        data: { gmailWatchExpiry: watchExpiry },
      });
      console.log(`[auth] Gmail watch registered for ${email}, expires ${watchExpiry.toISOString()}`);
    } catch (err) {
      console.error(`[auth] Gmail watch failed for ${email} (non-fatal):`, err);
    }

    const sessionToken = issueSessionToken(user.id);

    // Redirect back into the app via the registered fain:// URL scheme.
    // The app's Linking handler picks this up and saves the session.
    const deepLink = `fain://auth?token=${encodeURIComponent(sessionToken)}&email=${encodeURIComponent(user.email)}`;
    res.redirect(deepLink);
  } catch (error) {
    console.error("[auth] Google OAuth callback failed:", error);
    res.status(500).json({ error: "Google authentication failed" });
  }
});
