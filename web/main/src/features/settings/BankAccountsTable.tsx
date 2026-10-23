"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormCheckbox } from "@/components/forms/FormCheckbox";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormTextField } from "@/components/forms/FormTextField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageActions } from "@/components/shared/PageActions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useBankAccounts,
  useCreateBankAccount,
  useDeleteBankAccount,
  useUpdateBankAccount,
} from "@/hooks/queries/useExpenses";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { BankAccount } from "@/types/api/expenses";

/**
 * The accounts expenses are paid from. The balance is the opening balance
 * less every expense paid from it — not a live feed from the bank.
 */
export function BankAccountsTable() {
  const { data, isLoading, error, refetch } = useBankAccounts();
  const remove = useDeleteBankAccount();
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<BankAccount | null>(null);

  const columns: DataTableColumn<BankAccount>[] = [
    {
      key: "name",
      header: "Account",
      render: (account) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{account.name}</span>
            {!account.is_active && <Badge variant="outline">Closed</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {[account.bank_name, account.account_number ?? account.iban]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "end",
      render: (account) => formatMoney(account.balance, account.currency),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (account) => (
        <Button variant="ghost" size="sm" onClick={() => setDeleting(account)}>
          Delete
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageActions>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New account
        </Button>
      </PageActions>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(account) => account.id}
        onRowClick={setEditing}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">No bank accounts yet.</p>
        }
        mobileCardTitle={(account) => account.name}
        mobileCardFields={[
          {
            key: "balance",
            label: "Balance",
            render: (account) => formatMoney(account.balance, account.currency),
          },
        ]}
      />
      <BankAccountDialog
        account={editing}
        open={creating || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Expenses paid from it keep their record of it."
        confirmLabel="Delete account"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync([deleting!.id]);
            toast.success("Account deleted");
            setDeleting(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}

function BankAccountDialog({
  account,
  open,
  onOpenChange,
}: {
  account: BankAccount | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const create = useCreateBankAccount();
  const update = useUpdateBankAccount();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? `Edit ${account.name}` : "New bank account"}</DialogTitle>
          <DialogDescription>
            What the balance was when you started recording expenses.
          </DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{
            name: account?.name ?? "",
            bank_name: account?.bank_name ?? "",
            account_number: account?.account_number ?? "",
            iban: account?.iban ?? "",
            opening_balance: account?.opening_balance ?? "",
            is_active: account?.is_active ?? true,
          }}
          enableReinitialize
          validationSchema={Yup.object({ name: Yup.string().trim().required("Name the account") })}
          onSubmit={async (values, helpers) => {
            const payload = {
              name: values.name,
              bank_name: values.bank_name || null,
              account_number: values.account_number || null,
              iban: values.iban || null,
              opening_balance: values.opening_balance ? String(values.opening_balance) : null,
              is_active: values.is_active,
            };
            try {
              if (account) await update.mutateAsync([account.id, payload]);
              else await create.mutateAsync([{ ...payload, currency }]);
              toast.success(account ? "Account updated" : "Account added");
              onOpenChange(false);
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
          {({ isSubmitting }) => (
            <Form className="grid gap-4 sm:grid-cols-2">
              <FormTextField name="name" label="Name" placeholder="Shop current account" />
              <FormTextField name="bank_name" label="Bank" placeholder="Meezan Bank" />
              <FormTextField name="account_number" label="Account number" />
              <FormTextField name="iban" label="IBAN" />
              <FormNumberField name="opening_balance" label="Opening balance" suffix={currency} />
              {account && <FormCheckbox name="is_active" label="Still in use" />}
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {account ? "Save" : "Add account"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
