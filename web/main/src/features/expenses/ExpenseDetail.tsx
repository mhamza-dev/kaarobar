"use client";

import { useRouter } from "next/navigation";

import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSkeleton } from "@/components/shared/DetailSkeleton";
import { LoadError } from "@/components/shared/LoadError";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import { Badge } from "@/components/ui/badge";
import {
  useApproveExpense,
  useDeleteExpense,
  useExpense,
  useRejectExpense,
} from "@/hooks/queries/useExpenses";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDate, formatDateTime, formatMoney, humanize } from "@/lib/format";

/** One expense: what, how much, from where, and — if it's waiting — approving it. */
export function ExpenseDetail({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const { can } = usePermission();
  const { data: expense, isLoading, isError, refetch } = useExpense(expenseId);
  const approve = useApproveExpense();
  const reject = useRejectExpense();
  const remove = useDeleteExpense();

  if (isLoading) return <DetailSkeleton />;
  if (isError || !expense) return <LoadError what="this expense" onRetry={() => refetch()} />;

  const money = (value: string | null | undefined) => formatMoney(value, expense.currency);
  const canApprove = can("expense:approve");

  const actions: WorkflowAction[] = [
    {
      key: "approve",
      label: "Approve",
      variant: "default",
      available: expense.status === "pending",
      permitted: canApprove,
      pending: approve.isPending,
      onAction: async () => {
        await approve.mutateAsync([expense.id]);
        toast.success("Expense approved");
      },
    },
    {
      key: "reject",
      label: "Reject",
      available: expense.status === "pending",
      permitted: canApprove,
      pending: reject.isPending,
      confirm: {
        title: `Reject ${expense.number}?`,
        description: "It stays on record but doesn't count against profit.",
        confirmLabel: "Reject",
      },
      onAction: async () => {
        await reject.mutateAsync([expense.id]);
        toast.success("Expense rejected");
      },
    },
    {
      key: "delete",
      label: "Delete",
      variant: "destructive",
      available: true,
      permitted: canApprove,
      pending: remove.isPending,
      confirm: {
        title: `Delete ${expense.number}?`,
        description: expense.bank_account
          ? `${money(expense.gross)} goes back onto ${expense.bank_account.name}.`
          : "It stops counting against profit.",
        confirmLabel: "Delete expense",
        destructive: true,
      },
      onAction: async () => {
        await remove.mutateAsync([expense.id]);
        toast.success("Expense deleted");
        router.replace("/expenses");
      },
    },
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <StatusBadge status={expense.status} />
            {!expense.counts_against_profit && <Badge variant="outline">Not counted</Badge>}
          </div>
          <p className="text-3xl font-semibold tabular-nums">{money(expense.gross)}</p>
        </div>
        <WorkflowActions actions={actions} />
      </div>

      <DescriptionList
        className="rounded-xl border border-border px-4"
        items={[
          { label: "What for", value: expense.description },
          { label: "Category", value: expense.category?.name },
          { label: "Spent on", value: formatDate(expense.spent_on) },
          { label: "Amount", value: money(expense.amount) },
          {
            label: "Tax in it",
            value: money(expense.tax_amount),
            hidden: !Number(expense.tax_amount),
          },
          {
            label: "Paid by",
            value: expense.bank_account?.name ?? (expense.method ? humanize(expense.method) : null),
          },
          { label: "Reference", value: expense.reference },
          { label: "Recorded by", value: expense.recorded_by },
          {
            label: "Approved",
            value: `${expense.approved_by ?? ""} · ${formatDateTime(expense.approved_at)}`,
            hidden: !expense.approved_at,
          },
        ]}
      />
      {expense.notes && (
        <p className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-line">{expense.notes}</p>
      )}
    </div>
  );
}
