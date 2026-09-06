export interface EmailPayload {
  subject: string;
  fromAddress: string;
  bodyText: string;
}

export interface ParsedTransaction {
  amount: number;
  currency: string;
  direction: "debit" | "credit";
  merchantRaw: string;
  transactionDate: Date;
  accountLast4?: string;
}

export interface BankTemplate {
  name: string;
  matches(email: EmailPayload): boolean;
  parse(email: EmailPayload): ParsedTransaction | null;
}
