"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { ExpensesScreen, RecordExpenseDialog } from "@/features/expenses/ExpensesScreen";
import { usePermission } from "@/hooks/usePermission";

export default function ExpensesPage() {
  const { can } = usePermission();
  return (
    <>
      <PageHeader
        eyebrow="Money"
        title="Expenses"
        description="Rent, bills, wages — what it costs to run the business."
        actions={can("expense:create") && <RecordExpenseDialog />}
      />
      <ExpensesScreen />
    </>
  );
}
