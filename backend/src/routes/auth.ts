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
    // Try deep link first; show token on screen as fallback for browser-based testing.
    const deepLink = `fain://auth?token=${encodeURIComponent(sessionToken)}&email=${encodeURIComponent(user.email)}`;
    res.send(`<!DOCTYPE html><html><body style="font-family:monospace;padding:32px;background:#0f172a;color:#f8fafc">
<h2>Logged in as ${user.email}</h2>
<p>Copy this token and paste it into the app's dev token field:</p>
<textarea rows="4" style="width:100%;background:#1e293b;color:#94a3b8;border:1px solid #334155;padding:12px;border-radius:8px;font-size:12px" onclick="this.select()">${sessionToken}</textarea>
<br><br>
<a href="${deepLink}" style="color:#6366f1">Open in app (fain://)</a>
</body></html>`);
  } catch (error) {
    console.error("[auth] Google OAuth callback failed:", error);
    res.status(500).json({ error: "Google authentication failed" });
  }
});
