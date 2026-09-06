import { BankTemplate, EmailPayload, ParsedTransaction } from "./types";

// HTML-derived, labeled fields spread across whitespace:
// "Transaction Amount: \n INR 250" / "Merchant Name: \n SWIGGY FOOD" /
// "Axis Bank Credit Card No. \n XX6329" / "Date & Time: \n 29/07/2026 14:32:10"
function extractField(bodyText: string, label: string): string | null {
  const re = new RegExp(`${label}\\s*:?\\s*\\n?\\s*([^\\n]+)`, "i");
  return re.exec(bodyText)?.[1]?.trim() ?? null;
}

export const axisTemplate: BankTemplate = {
  name: "axis",

  matches(email: EmailPayload): boolean {
    return /axisbank\.com/i.test(email.fromAddress) || /Axis Bank/i.test(email.subject);
  },

  parse(email: EmailPayload): ParsedTransaction | null {
    const amountField = extractField(email.bodyText, "Transaction Amount");
    const merchantRaw = extractField(email.bodyText, "Merchant Name");
    const cardField = extractField(email.bodyText, "Axis Bank Credit Card No\\.?");
    const dateField = extractField(email.bodyText, "Date\\s*&?\\s*Time");

    if (!amountField || !merchantRaw) return null;

    const amountMatch = /^([A-Z]{3})\s+([\d,]+\.?\d*)/.exec(amountField);
    if (!amountMatch) return null;
    const [, currency, amountStr] = amountMatch;

    const last4 = cardField ? /(\d{4})/.exec(cardField)?.[1] : undefined;

    let transactionDate = dateField ? new Date(dateField.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$2/$1/$3")) : null;
    if (!transactionDate || Number.isNaN(transactionDate.getTime())) {
      transactionDate = new Date();
    }

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
