import { google } from "googleapis";
import { env } from "../config/env";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function createOAuthClient() {
  return new google.auth.OAuth2(
    env.gmailClientId,
    env.gmailClientSecret,
    env.gmailRedirectUri,
  );
}

export function getConsentUrl() {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // required to receive a refresh token
    prompt: "consent", // forces refresh token on repeat authorizations too
    scope: [GMAIL_READONLY_SCOPE],
  });
}

export async function exchangeCodeForTokens(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token returned — user may have already granted consent without 'prompt=consent', or 'access_type=offline' was not honored.",
    );
  }
  return tokens;
}

// Uses Gmail's own getProfile endpoint (covered by the gmail.readonly scope
// we already request) instead of the separate userinfo API, which would need
// its own scope.
export async function getGmailProfileEmail(accessToken: string): Promise<string> {
  const client = createOAuthClient();
  client.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth: client });
  const { data } = await gmail.users.getProfile({ userId: "me" });
  if (!data.emailAddress) {
    throw new Error("Gmail profile did not return an email address");
  }
  return data.emailAddress;
}
