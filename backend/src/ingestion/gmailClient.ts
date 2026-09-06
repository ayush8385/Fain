import { google } from "googleapis";
import { createOAuthClient } from "../auth/googleOAuth";
import { decryptToken } from "../auth/tokenCrypto";

export interface EmailCandidate {
  gmailMessageId: string;
  subject: string;
  fromAddress: string;
  receivedAt: Date;
}

// Cheap, deliberately broad pre-filter to avoid fetching every email in the inbox.
// This does NOT decide what counts as a transaction — it only narrows candidates
// down from "everything" to "plausibly finance-related". The actual decision
// (is this a completed transaction, and what are its fields) is made downstream
// by the rule engine and, for anything unrecognized, the LLM classifier — so new
// bank domains or subject wording don't require editing this query.
const TRANSACTION_QUERY =
  '(category:primary OR category:updates) (subject:(debited OR credited OR debit OR credit OR txn OR transaction OR payment OR spent OR purchase OR withdrawn OR "account update" OR alert OR statement))';

export function getGmailClient(refreshTokenEncrypted: string) {
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: decryptToken(refreshTokenEncrypted) });
  return google.gmail({ version: "v1", auth: client });
}

function getHeader(headers: { name?: string | null; value?: string | null }[] | undefined, name: string) {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
}

/**
 * Lists candidate transaction emails newer than `afterDate` (or all matching, if omitted).
 * Returns lightweight metadata only — no message body — for the ingestion staging table.
 */
export async function listTransactionCandidates(
  refreshTokenEncrypted: string,
  afterDate?: Date,
): Promise<EmailCandidate[]> {
  const gmail = getGmailClient(refreshTokenEncrypted);

  const query = afterDate
    ? `${TRANSACTION_QUERY} after:${Math.floor(afterDate.getTime() / 1000)}`
    : TRANSACTION_QUERY;

  const messages: { id?: string | null }[] = [];
  let pageToken: string | undefined;
  do {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 100,
      pageToken,
    });
    messages.push(...(listRes.data.messages ?? []));
    pageToken = listRes.data.nextPageToken ?? undefined;
  } while (pageToken);

  const candidates: EmailCandidate[] = [];
  for (const message of messages) {
    if (!message.id) continue;

    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id: message.id,
      format: "metadata",
      metadataHeaders: ["Subject", "From", "Date"],
    });

    const headers = msgRes.data.payload?.headers;
    candidates.push({
      gmailMessageId: message.id,
      subject: getHeader(headers, "Subject"),
      fromAddress: getHeader(headers, "From"),
      receivedAt: new Date(Number(msgRes.data.internalDate ?? Date.now())),
    });
  }

  return candidates;
}

const PUBSUB_TOPIC = "projects/scan-503220/topics/gmail-notifications";

/**
 * Registers a Gmail push-notification watch for the user's inbox.
 * Gmail will POST to our Pub/Sub subscription whenever a new message arrives.
 * Watches expire after 7 days — store the expiry date so the scheduler can renew.
 * Returns the expiry timestamp (ms epoch) from Gmail's response.
 */
export async function watchUserInbox(refreshTokenEncrypted: string): Promise<Date> {
  const gmail = getGmailClient(refreshTokenEncrypted);
  const res = await gmail.users.watch({
    userId: "me",
    requestBody: {
      topicName: PUBSUB_TOPIC,
      labelIds: ["INBOX"],
    },
  });

  const expiryMs = Number(res.data.expiration ?? 0);
  if (!expiryMs) throw new Error("Gmail watch response missing expiration");
  return new Date(expiryMs);
}

export interface EmailContent {
  gmailMessageId: string;
  subject: string;
  fromAddress: string;
  bodyText: string;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64").toString("utf8");
}

function extractPlainText(payload: any): string {
  if (!payload) return "";

  // Prefer text/plain; fall back to text/html stripped of tags.
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.mimeType === "text/html" && payload.body?.data) {
    return decodeBase64Url(payload.body.data).replace(/<[^>]+>/g, " ");
  }

  for (const part of payload.parts ?? []) {
    const text = extractPlainText(part);
    if (text) return text;
  }

  return "";
}

/**
 * Fetches a single email's full body for parsing. Content is returned in-memory
 * only — callers must not persist bodyText to the database (see IngestedEmail
 * schema comment: only Gmail message IDs are stored, never raw content).
 */
export async function getEmailContent(
  refreshTokenEncrypted: string,
  gmailMessageId: string,
): Promise<EmailContent> {
  const gmail = getGmailClient(refreshTokenEncrypted);
  const msgRes = await gmail.users.messages.get({
    userId: "me",
    id: gmailMessageId,
    format: "full",
  });

  const headers = msgRes.data.payload?.headers;
  return {
    gmailMessageId,
    subject: getHeader(headers, "Subject"),
    fromAddress: getHeader(headers, "From"),
    bodyText: extractPlainText(msgRes.data.payload).trim(),
  };
}
