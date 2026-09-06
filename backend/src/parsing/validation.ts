import { ParsedTransaction } from "./templates/types";

// Shared field validation for any extraction path that produces loosely-typed
// field values (LLM tool-call output, learned-pattern regex capture groups) —
// both must pass through the same checks before being trusted as a Transaction.
export function validateParsedFields(result: Record<string, unknown>): ParsedTransaction | null {
  const amount = Number(result.amount);
  const direction = result.direction === "credit" ? "credit" : "debit";
  const merchantRaw = typeof result.merchantRaw === "string" ? result.merchantRaw.trim() : "";
  const transactionDate = result.transactionDate ? new Date(String(result.transactionDate)) : null;

  if (!Number.isFinite(amount) || !merchantRaw || !transactionDate || Number.isNaN(transactionDate.getTime())) {
    return null;
  }

  return {
    amount,
    currency: typeof result.currency === "string" && result.currency ? result.currency : "INR",
    direction,
    merchantRaw,
    transactionDate,
    accountLast4: typeof result.accountLast4 === "string" ? result.accountLast4 : undefined,
  };
}
