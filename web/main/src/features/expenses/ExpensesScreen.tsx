"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Yup from "yup";

import { FormCheckbox } from "@/components/forms/FormCheckbox";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { FormTextField } from "@/components/forms/FormTextField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { LoadError } from "@/components/shared/LoadError";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useBankAccounts,
  useCreateExpense,
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useExpenses,
  useSpendByCategory,
} from "@/hooks/queries/useExpenses";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDate, formatMoney, humanize, todayIso } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import {
  EXPENSE_CATEGORY_KINDS,
  EXPENSE_METHODS,
  EXPENSE_STATUSES,
  type Expense,
  type ExpenseCategory,
} from "@/types/api/expenses";

/** Money spent running the business: the list, where it went, and its categories. */
export function ExpensesScreen() {
  return (
    <Tabs defaultValue="expenses">
      <TabsList variant="line">
        <TabsTrigger value="expenses">Expenses</TabsTrigger>
        <TabsTrigger value="spend">By category</TabsTrigger>
        <TabsTrigger value="categories">Categories</TabsTrigger>
      </TabsList>
      <TabsContent value="expenses" className="pt-4">
        <ExpensesTable />
      </TabsContent>
      <TabsContent value="spend" className="pt-4">
        <SpendByCategory />
      </TabsContent>
      <TabsContent value="categories" className="pt-4">
        <CategoriesPanel />
      </TabsContent>
    </Tabs>
  );
}

function ExpensesTable() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useExpenses();

  const columns: DataTableColumn<Expense>[] = [
    {
      key: "description",
      header: "Expense",
      render: (expense) => (
        <div>
          <p className="font-medium">{expense.description}</p>
          <p className="text-xs text-muted-foreground">
            {expense.number} · {expense.category?.name ?? "Uncategorised"}
          </p>
        </div>
      ),
    },
    { key: "spent", header: "Spent on", render: (expense) => formatDate(expense.spent_on) },
    {
      key: "method",
      header: "Paid by",
      render: (expense) =>
        expense.bank_account?.name ?? (expense.method ? humanize(expense.method) : "—"),
    },
    {
      key: "status",
      header: "Status",
      render: (expense) => <StatusBadge status={expense.status} />,
    },
    {
      key: "gross",
      header: "Amount",
      align: "end",
      render: (expense) => (
        <span className="font-medium">{formatMoney(expense.gross, expense.currency)}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data ?? []}
      rowKey={(expense) => expense.id}
      onRowClick={(expense) => router.push(`/expenses/${expense.id}`)}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      search={{
        getText: (expense) =>
          `${expense.description} ${expense.number} ${expense.category?.name ?? ""}`,
      }}
      filters={[
        {
          id: "status",
          label: "Status",
          type: "select",
          options: EXPENSE_STATUSES.map((value) => ({ value, label: humanize(value) })),
          getValue: (expense) => expense.status,
        },
      ]}
      empty={<p className="p-6 text-center text-sm text-muted-foreground">No expenses recorded.</p>}
      mobileCardTitle={(expense) => expense.description}
      mobileCardSubtitle={(expense) => formatDate(expense.spent_on)}
      mobileCardFields={[
        {
          key: "gross",
          label: "Amount",
          render: (expense) => formatMoney(expense.gross, expense.currency),
        },
      ]}
    />
  );
}

function SpendByCategory() {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const { data, isLoading, error, refetch } = useSpendByCategory({
    from: from || undefined,
    to: to || undefined,
  });
  const max = Math.max(1, ...(data?.categories ?? []).map((row) => Number(row.total)));

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="spend-from">From</Label>
          <Input
            id="spend-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="spend-to">To</Label>
          <Input
            id="spend-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
        <p className="pb-2 text-sm text-muted-foreground">
          {from || to ? "" : "The last 30 days."}
        </p>
      </div>

      {error ? (
        <LoadError what="the spend" onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Operating spend (comes off profit)</p>
            <p className="text-2xl font-semibold tabular-nums">
              {formatMoney(data.operating_total, currency)}
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {data.categories.map((row) => (
              <li key={row.category_id} className="flex flex-col gap-1 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>
                    {row.category}
                    {!row.counted_against_profit && (
                      <Badge variant="outline" className="ml-2">
                        In cost of sales
                      </Badge>
                    )}
                  </span>
                  <span className="tabular-nums">
                    {formatMoney(row.total, currency)}
                    <span className="text-xs text-muted-foreground"> · {row.count}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted" aria-hidden>
                  <div
                    className="h-2 rounded-full bg-brand-primary"
                    style={{ width: `${(Number(row.total) / max) * 100}%` }}
                  />
                </div>
              </li>
            ))}
            {data.categories.length === 0 && (
              <li className="text-sm text-muted-foreground">Nothing spent in this period.</li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function CategoriesPanel() {
  const { can } = usePermission();
  const canManage = can("expense:create");
  const { data, isLoading, error, refetch } = useExpenseCategories();
  const create = useCreateExpenseCategory();
  const remove = useDeleteExpenseCategory();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("operating");
  const [deleting, setDeleting] = useState<ExpenseCategory | null>(null);

  const columns: DataTableColumn<ExpenseCategory>[] = [
    {
      key: "name",
      header: "Category",
      render: (category) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{category.name}</span>
          {!category.is_active && <Badge variant="outline">Hidden</Badge>}
        </div>
      ),
    },
    { key: "kind", header: "Kind", render: (category) => humanize(category.kind) },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "end" as const,
            render: (category: ExpenseCategory) => (
              <Button variant="ghost" size="sm" onClick={() => setDeleting(category)}>
                Delete
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <div className="flex max-w-3xl flex-col gap-3">
      {canManage && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            try {
              await create.mutateAsync([{ name: name.trim(), kind }]);
              toast.success(`${name.trim()} added`);
              setName("");
            } catch {
              // Toasted by the hook.
            }
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-name">New category</Label>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Rent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category-kind">Kind</Label>
            <select
              id="category-kind"
              value={kind}
              onChange={(event) => setKind(event.target.value)}
              className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
            >
              {EXPENSE_CATEGORY_KINDS.map((value) => (
                <option key={value} value={value}>
                  {humanize(value)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="outline" disabled={!name.trim() || create.isPending}>
            <Plus className="size-4" />
            Add
          </Button>
        </form>
      )}
      <DataTable
        embedded
        columns={columns}
        rows={data ?? []}
        rowKey={(category) => category.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">
            No categories yet — add Rent, say, or Utilities.
          </p>
        }
        mobileCardTitle={(category) => category.name}
        mobileCardSubtitle={(category) => humanize(category.kind)}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Expenses already filed under it keep it; it just can't be picked for new ones."
        confirmLabel="Delete category"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync([deleting!.id]);
            toast.success("Category deleted");
            setDeleting(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </div>
  );
}

const expenseSchema = Yup.object({
  expense_category_id: Yup.string().required("Pick a category"),
  description: Yup.string().trim().required("Say what it was for"),
  amount: Yup.number()
    .typeError("Enter the amount")
    .positive("Enter more than zero")
    .required("Enter the amount"),
  spent_on: Yup.string().required("When was it spent?"),
});

export function RecordExpenseDialog() {
  const router = useRouter();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { can } = usePermission();
  const [open, setOpen] = useState(false);
  const { data: categories } = useExpenseCategories();
  const { data: accounts } = useBankAccounts(open && can("bank_account:manage"));
  const create = useCreateExpense();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Record expense
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record an expense</DialogTitle>
            <DialogDescription>
              Paid from a bank account, its balance comes down with it.
            </DialogDescription>
          </DialogHeader>
          <Formik
            initialValues={{
              expense_category_id: "",
              description: "",
              amount: "",
              tax_amount: "",
              method: "cash",
              bank_account_id: "",
              spent_on: todayIso(),
              reference: "",
              notes: "",
              needs_approval: false,
            }}
            validationSchema={expenseSchema}
            onSubmit={async (values, helpers) => {
              try {
                const expense = (await create.mutateAsync([
                  {
                    expense_category_id: values.expense_category_id,
                    description: values.description,
                    amount: String(values.amount),
                    tax_amount: values.tax_amount ? String(values.tax_amount) : null,
                    method: values.method,
                    bank_account_id:
                      values.method === "bank" ? values.bank_account_id || null : null,
                    spent_on: values.spent_on,
                    reference: values.reference || null,
                    notes: values.notes || null,
                    status: values.needs_approval ? "pending" : "recorded",
                  },
                ])) as Expense;
                toast.success(`${expense.number} recorded`);
                helpers.resetForm();
                setOpen(false);
                router.push(`/expenses/${expense.id}`);
              } catch (error) {
                const { unmapped } = applyApiFieldErrors({
                  error,
                  values,
                  setErrors: helpers.setErrors,
                });
                for (const message of unmapped) toast.error(message);
              }
            }}
          >
            {({ isSubmitting, values }) => (
              <Form className="flex flex-col gap-4">
                <FormTextField name="description" label="What for" placeholder="September rent" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormSelectField
                    name="expense_category_id"
                    label="Category"
                    options={(categories ?? [])
                      .filter((category) => category.is_active)
                      .map((category) => ({ value: category.id, label: category.name }))}
                  />
                  <FormDatePicker name="spent_on" label="Spent on" max={todayIso()} />
                  <FormNumberField name="amount" label="Amount" min={0} suffix={currency} />
                  <FormNumberField name="tax_amount" label="Tax in it" min={0} suffix={currency} />
                  <FormSelectField
                    name="method"
                    label="Paid by"
                    options={EXPENSE_METHODS.map((value) => ({ value, label: humanize(value) }))}
                  />
                  {values.method === "bank" && (
                    <FormSelectField
                      name="bank_account_id"
                      label="From account"
                      options={(accounts ?? []).map((account) => ({
                        value: account.id,
                        label: account.name,
                      }))}
                    />
                  )}
                  <FormTextField name="reference" label="Reference" placeholder="Receipt no." />
                </div>
                <FormTextareaField name="notes" label="Notes" rows={2} />
                <FormCheckbox
                  name="needs_approval"
                  label="Send for approval"
                  hint="It won't count until approved."
                />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Record
                  </Button>
                </DialogFooter>
              </Form>
            )}
          </Formik>
        </DialogContent>
      </Dialog>
    </>
  );
}
