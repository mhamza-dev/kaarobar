"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { ExpenseDetail } from "@/features/expenses/ExpenseDetail";

export default function ExpensePage({ params }: PageProps<"/expenses/[expenseId]">) {
  const { expenseId } = use(params);
  return (
    <>
      <PageHeader
        eyebrow="Expenses"
        title="Expense"
        back={{ href: "/expenses", label: "All expenses" }}
      />
      <ExpenseDetail expenseId={expenseId} />
    </>
  );
}
