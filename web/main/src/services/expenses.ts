import { apiClient } from "@/lib/api/client";
import type { ApiEnvelope } from "@/types/api/common";
import type {
  BankAccount,
  BankAccountPayload,
  Expense,
  ExpenseCategory,
  ExpenseFilters,
  ExpensePayload,
  SpendByCategory,
} from "@/types/api/expenses";

const get = async <T>(url: string, params?: object) =>
  (await apiClient.get<ApiEnvelope<T>>(url, { params })).data.data;
const post = async <T>(url: string, body: unknown = {}) =>
  (await apiClient.post<ApiEnvelope<T>>(url, body)).data.data;
const patch = async <T>(url: string, body: unknown) =>
  (await apiClient.patch<ApiEnvelope<T>>(url, body)).data.data;
const del = async (url: string) => {
  await apiClient.delete(url);
};

export const listExpenses = (filters: ExpenseFilters = {}) => get<Expense[]>("/expenses", filters);
export const getExpense = (id: string) => get<Expense>(`/expenses/${id}`);
/** Paid from a bank account, its balance moves in the same transaction. */
export const createExpense = (payload: ExpensePayload) => post<Expense>("/expenses", payload);
export const approveExpense = (id: string) => post<Expense>(`/expenses/${id}/approve`);
export const rejectExpense = (id: string) => post<Expense>(`/expenses/${id}/reject`);
export const deleteExpense = (id: string) => del(`/expenses/${id}`);

/** Spend by category over a period (default: the last 30 days). */
export const getSpendByCategory = (params: { from?: string; to?: string } = {}) =>
  get<SpendByCategory>("/expenses/by-category", params);

export const listExpenseCategories = () => get<ExpenseCategory[]>("/expenses/categories");
export const createExpenseCategory = (payload: { name: string; kind: string; code?: string | null }) =>
  post<ExpenseCategory>("/expenses/categories", payload);
export const updateExpenseCategory = (id: string, payload: Partial<ExpenseCategory>) =>
  patch<ExpenseCategory>(`/expenses/categories/${id}`, payload);
export const deleteExpenseCategory = (id: string) => del(`/expenses/categories/${id}`);

export const listBankAccounts = () => get<BankAccount[]>("/bank-accounts");
export const createBankAccount = (payload: BankAccountPayload) =>
  post<BankAccount>("/bank-accounts", payload);
export const updateBankAccount = (id: string, payload: Partial<BankAccountPayload>) =>
  patch<BankAccount>(`/bank-accounts/${id}`, payload);
export const deleteBankAccount = (id: string) => del(`/bank-accounts/${id}`);
