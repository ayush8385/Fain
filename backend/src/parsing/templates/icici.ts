import { BankTemplate, EmailPayload, ParsedTransaction } from "./types";

// "Your ICICI Bank Credit Card XX8006 has been used for a transaction of INR 788.75
//  on Jul 29, 2026 at 11:28:38. Info: AMAZON PAY IN GROCERY."
const TRANSACTION_RE =
  /Card\s+(?:XX)?(\d{4})\s+has been used for a transaction of\s+([A-Z]{3})\s+([\d,]+\.?\d*)\s+on\s+([A-Za-z]{3}\s+\d{1,2},\s+\d{4})\s+at\s+(\d{1,2}:\d{2}:\d{2}).*?Info:\s*([^.\r\n]+)/is;

export const iciciTemplate: BankTemplate = {
  name: "icici",

  matches(email: EmailPayload): boolean {
    return /icicibank\.com/i.test(email.fromAddress) || /ICICI Bank/i.test(email.subject);
  },

  parse(email: EmailPayload): ParsedTransaction | null {
    const match = TRANSACTION_RE.exec(email.bodyText);
    if (!match) return null;

    const [, last4, currency, amountStr, dateStr, timeStr, merchantRaw] = match;
    const transactionDate = new Date(`${dateStr} ${timeStr}`);
    if (Number.isNaN(transactionDate.getTime())) return null;

    return {
      amount: Number(amountStr.replace(/,/g, "")),
      currency,
      direction: "debit",
      merchantRaw: merchantRaw.trim(),
      transactionDate,
      accountLast4: last4,
    };
  },
};
