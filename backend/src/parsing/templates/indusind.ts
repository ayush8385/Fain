import { BankTemplate, EmailPayload, ParsedTransaction } from "./types";

// "The transaction on your IndusInd Bank Credit Card ending 5815 for INR 488.82
//  on 27-07-2026 01:01:36 pm at Upi Airtel is Approved."
const TRANSACTION_RE =
  /Credit Card ending\s+(\d{4})\s+for\s+([A-Z]{3})\s+([\d,]+\.?\d*)\s+on\s+(\d{2})-(\d{2})-(\d{4})\s+(\d{1,2}:\d{2}:\d{2}\s*[ap]m)\s+at\s+(.+?)\s+is\s+Approved/i;

export const indusindTemplate: BankTemplate = {
  name: "indusind",

  matches(email: EmailPayload): boolean {
    return /indusind\.com/i.test(email.fromAddress) || /IndusInd Bank/i.test(email.subject);
  },

  parse(email: EmailPayload): ParsedTransaction | null {
    const match = TRANSACTION_RE.exec(email.bodyText);
    if (!match) return null;

    const [, last4, currency, amountStr, dd, mm, yyyy, timeStr, merchantRaw] = match;
    const transactionDate = new Date(`${mm}/${dd}/${yyyy} ${timeStr}`);
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
