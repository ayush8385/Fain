import { Transaction } from "@prisma/client";

export interface NotificationPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

export function buildCategorizationPrompt(transaction: Transaction): NotificationPayload {
  const sign = transaction.direction === "debit" ? "-" : "+";
  const amount = `${sign}₹${Number(transaction.amount).toLocaleString("en-IN")}`;

  return {
    title: `${amount} at ${transaction.merchantRaw}`,
    body: "Tap to categorize this transaction",
    data: {
      type: "categorize",
      transactionId: transaction.id,
      merchantRaw: transaction.merchantRaw,
      amount: String(transaction.amount),
      direction: transaction.direction,
    },
  };
}
