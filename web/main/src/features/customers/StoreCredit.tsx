"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormTextField } from "@/components/forms/FormTextField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
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
import {
  useIssueStoreCredit,
  useRedeemStoreCredit,
  useStoreCreditHistory,
} from "@/hooks/queries/usePrepaid";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDate, formatDateTime, formatMoney, formatSigned, humanize } from "@/lib/format";
import type { StoreCreditTransaction } from "@/types/api/crm";

const issueSchema = Yup.object({
  amount: Yup.number().typeError("Enter an amount").positive("Enter more than zero").required(),
  reason: Yup.string().trim().required("Say why it's being given"),
});

/**
 * Store credit given to a customer — goodwill, a return taken as credit
 * rather than cash. Spent at the till like a tender.
 */
export function IssueStoreCreditDialog({
  customerId,
  currency,
}: {
  customerId: string;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const issue = useIssueStoreCredit();

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Give store credit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Give store credit</DialogTitle>
            <DialogDescription>
              The customer can spend it at the till. It isn&apos;t cash and can&apos;t be withdrawn.
            </DialogDescription>
          </DialogHeader>
          <Formik
            initialValues={{ amount: "", reason: "", expires_on: "" }}
            validationSchema={issueSchema}
            onSubmit={async (values, helpers) => {
              try {
                await issue.mutateAsync([
                  customerId,
                  {
                    amount: String(values.amount),
                    reason: values.reason,
                    expires_on: values.expires_on || null,
                  },
                ]);
                toast.success(`${formatMoney(String(values.amount), currency)} store credit given`);
                helpers.resetForm();
                setOpen(false);
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
              <Form className="flex flex-col gap-4">
                <FormNumberField name="amount" label="Amount" min={0} suffix={currency} />
                <FormTextField
                  name="reason"
                  label="Why"
                  placeholder="e.g. Late delivery, goodwill"
                />
                <FormDatePicker name="expires_on" label="Expires" hint="Leave blank for never." />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Give credit
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

/** One piece of store credit: what was given, what's been spent, and spending it by hand. */
export function StoreCreditSheet({
  creditId,
  onClose,
  currency,
}: {
  creditId: string | null;
  onClose: () => void;
  currency: string;
}) {
  const { can } = usePermission();
  const { data, isLoading, error, refetch } = useStoreCreditHistory(creditId);
  const redeem = useRedeemStoreCredit();
  const [amount, setAmount] = useState("");
  const credit = data?.credit;
  const money = (value: string | null | undefined) =>
    formatMoney(value, credit?.currency ?? currency);

  const columns: DataTableColumn<StoreCreditTransaction>[] = [
    {
      key: "kind",
      header: "Entry",
      render: (entry) => (
        <div>
          <p>{humanize(entry.kind)}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(entry.occurred_at)}</p>
        </div>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (entry) => formatSigned(entry.amount),
    },
    { key: "after", header: "Left", align: "end", render: (entry) => money(entry.balance_after) },
  ];

  return (
    <DetailSheet
      open={!!creditId}
      onOpenChange={(open) => !open && onClose()}
      eyebrow="Store credit"
      title={credit?.number}
      status={
        credit &&
        (credit.spendable ? (
          <Badge variant="secondary">Spendable</Badge>
        ) : (
          <Badge variant="outline">Not spendable</Badge>
        ))
      }
      loading={isLoading}
      error={error}
      onRetry={() => refetch()}
      what="this store credit"
    >
      {credit && (
        <div className="flex flex-col gap-4">
          <DescriptionList
            items={[
              {
                label: "Left to spend",
                value: <span className="font-semibold">{money(credit.balance)}</span>,
              },
              { label: "Given", value: money(credit.issued_amount) },
              { label: "Why", value: credit.reason },
              { label: "Given on", value: formatDateTime(credit.issued_at) },
              {
                label: "Expires",
                value: credit.expires_on ? formatDate(credit.expires_on) : "Never",
              },
            ]}
          />

          {credit.spendable && can("store_credit:redeem") && (
            <form
              className="flex items-end gap-2"
              onSubmit={async (event) => {
                event.preventDefault();
                if (!(Number(amount) > 0)) return toast.error("Enter an amount to spend");
                try {
                  await redeem.mutateAsync([credit.id, amount]);
                  toast.success(`${money(amount)} spent from ${credit.number}`);
                  setAmount("");
                } catch {
                  // Toasted by the hook.
                }
              }}
            >
              <div className="flex flex-1 flex-col gap-1.5">
                <Label htmlFor="redeem-amount">Spend from it</Label>
                <Input
                  id="redeem-amount"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder={credit.balance ?? "0"}
                />
              </div>
              <Button type="submit" variant="outline" disabled={redeem.isPending}>
                {redeem.isPending && <Loader2 className="size-4 animate-spin" />}
                Spend
              </Button>
            </form>
          )}

          <DataTable
            embedded
            columns={columns}
            rows={[...(data?.transactions ?? [])].reverse()}
            rowKey={(entry) => entry.id}
            mobileCardTitle={(entry) => humanize(entry.kind)}
            mobileCardFields={[
              { key: "amount", label: "Amount", render: (entry) => formatSigned(entry.amount) },
            ]}
          />
        </div>
      )}
    </DetailSheet>
  );
}
