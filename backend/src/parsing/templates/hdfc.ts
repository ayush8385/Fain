import { BankTemplate, EmailPayload, ParsedTransaction } from "./types";

// Covers both HDFC UPI alert shapes:
//  "Rs.53.00 has been debited from account 0490 to VPA 8409080443@nyes Nsiba Bibi on 09-04-26."
//  "Rs.222.00 has been debited from your HDFC Bank RuPay Credit Card XX7145 to cp.zepto13a87@axisb ZEPTO on 06-04-26."
const TRANSACTION_RE =
  /Rs\.?\s*([\d,]+\.?\d*)\s+has been (debited|credited)\s+(?:from|to)\s+(?:account\s+(\d+)|your HDFC Bank .*?Card\s+(?:XX)?(\d+))\s+(?:to|from)\s+(?:VPA\s+)?\S+\s+(.+?)\s+on\s+(\d{2})-(\d{2})-(\d{2})\./is;

export const hdfcTemplate: BankTemplate = {
  name: "hdfc",

  matches(email: EmailPayload): boolean {
    return /hdfcbank\.(net|com)/i.test(email.fromAddress) || /HDFC Bank/i.test(email.subject);
  },

  parse(email: EmailPayload): ParsedTransaction | null {
    const match = TRANSACTION_RE.exec(email.bodyText);
    if (!match) return null;

    const [, amountStr, verb, accountLast4, cardLast4, merchantRaw, dd, mm, yy] = match;
    const transactionDate = new Date(2000 + Number(yy), Number(mm) - 1, Number(dd));
    if (Number.isNaN(transactionDate.getTime())) return null;

    return {
      amount: Number(amountStr.replace(/,/g, "")),
      currency: "INR",
      direction: verb.toLowerCase() === "credited" ? "credit" : "debit",
      merchantRaw: merchantRaw.trim(),
      transactionDate,
      accountLast4: accountLast4 ?? cardLast4,
    };
  },
};
