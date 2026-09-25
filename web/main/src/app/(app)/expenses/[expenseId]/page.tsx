"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { ExpenseDetail } from "@/features/expenses/ExpenseDetail";

export default function ExpensePage({ params }: PageProps<"/expenses/[expenseId]">) {
  const { expenseId } = use(params);
  return (
    <>
      <PageHeader
        eyebrow="Expenses"
        title="Expense"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/expenses" />}>
            <ArrowLeft className="size-4" />
            All expenses
          </Button>
        }
      />
      <ExpenseDetail expenseId={expenseId} />
    </>
  );
}
