import { useQuery } from "@tanstack/react-query";

import {
  approveExpense,
  createBankAccount,
  createExpense,
  createExpenseCategory,
  deleteBankAccount,
  deleteExpense,
  deleteExpenseCategory,
  getExpense,
  getSpendByCategory,
  listBankAccounts,
  listExpenseCategories,
  listExpenses,
  rejectExpense,
  updateBankAccount,
  updateExpenseCategory,
} from "@/services/expenses";
import type {
  BankAccountPayload,
  ExpenseCategory,
  ExpenseFilters,
  ExpensePayload,
} from "@/types/api/expenses";

import { useTenantKey } from "./keys";
import { useInvalidatingMutation } from "./mutations";

// An expense moves a bank balance and the profit report along with its list.
const EXPENSE_KEYS = ["expenses", "expense", "expense-spend", "bank-accounts", "reports"];

export function useExpenses(filters: ExpenseFilters = {}) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["expenses", tenant, filters],
    queryFn: () => listExpenses(filters),
  });
}
export function useExpense(id: string | undefined) {
  return useQuery({ queryKey: ["expense", id], queryFn: () => getExpense(id!), enabled: !!id });
}
export function useSpendByCategory(params: { from?: string; to?: string }) {
  const tenant = useTenantKey();
  return useQuery({
    queryKey: ["expense-spend", tenant, params],
    queryFn: () => getSpendByCategory(params),
  });
}
export function useExpenseCategories() {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["expense-categories", tenant], queryFn: listExpenseCategories });
}
export function useBankAccounts(enabled = true) {
  const tenant = useTenantKey();
  return useQuery({ queryKey: ["bank-accounts", tenant], queryFn: listBankAccounts, enabled });
}

export const useCreateExpense = () =>
  useInvalidatingMutation<[ExpensePayload], unknown>(createExpense, EXPENSE_KEYS);
export const useApproveExpense = () =>
  useInvalidatingMutation<[string], unknown>(approveExpense, EXPENSE_KEYS);
export const useRejectExpense = () =>
  useInvalidatingMutation<[string], unknown>(rejectExpense, EXPENSE_KEYS);
export const useDeleteExpense = () =>
  useInvalidatingMutation<[string], unknown>(deleteExpense, EXPENSE_KEYS);

const CATEGORY_KEYS = ["expense-categories", "expenses", "expense-spend"];
export const useCreateExpenseCategory = () =>
  useInvalidatingMutation<[{ name: string; kind: string; code?: string | null }], unknown>(
    createExpenseCategory,
    CATEGORY_KEYS,
  );
export const useUpdateExpenseCategory = () =>
  useInvalidatingMutation<[string, Partial<ExpenseCategory>], unknown>(
    updateExpenseCategory,
    CATEGORY_KEYS,
  );
export const useDeleteExpenseCategory = () =>
  useInvalidatingMutation<[string], unknown>(deleteExpenseCategory, CATEGORY_KEYS);

const BANK_KEYS = ["bank-accounts", "expenses"];
export const useCreateBankAccount = () =>
  useInvalidatingMutation<[BankAccountPayload], unknown>(createBankAccount, BANK_KEYS);
export const useUpdateBankAccount = () =>
  useInvalidatingMutation<[string, Partial<BankAccountPayload>], unknown>(
    updateBankAccount,
    BANK_KEYS,
  );
export const useDeleteBankAccount = () =>
  useInvalidatingMutation<[string], unknown>(deleteBankAccount, BANK_KEYS);
