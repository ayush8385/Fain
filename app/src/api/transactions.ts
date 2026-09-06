import { apiClient } from "./client";

export interface Category {
  id: string;
  name: string;
  icon: string | null;
}

export interface Transaction {
  id: string;
  amount: string;
  currency: string;
  direction: "debit" | "credit";
  merchantRaw: string;
  merchantNormalized: string;
  transactionDate: string;
  accountLast4: string | null;
  extractionMethod: string;
  categoryId: string | null;
  categoryConfidence: number | null;
  status: "auto_categorized" | "needs_review" | "confirmed";
  category: Category | null;
  createdAt: string;
}

export async function fetchTransactions(status?: string): Promise<Transaction[]> {
  const params = status ? { status } : {};
  const { data } = await apiClient.get<Transaction[]>("/transactions", { params });
  return data;
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>("/categories");
  return data;
}

export async function setTransactionCategory(transactionId: string, categoryId: string): Promise<Transaction> {
  const { data } = await apiClient.patch<Transaction>(`/transactions/${transactionId}/category`, { categoryId });
  return data;
}

export async function registerDeviceToken(token: string, platform: "ios" | "android"): Promise<void> {
  await apiClient.post("/push/register-device", { token, platform });
}
