"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormTextField } from "@/components/forms/FormTextField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { LoadError } from "@/components/shared/LoadError";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdjustLoyaltyPoints,
  useLoyaltyHistory,
  useLoyaltyProgram,
} from "@/hooks/queries/useCustomers";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { isNotFound } from "@/lib/api/errors";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDate, formatDateTime, formatQuantity, humanize } from "@/lib/format";
import type { LoyaltyTransaction } from "@/types/api/crm";

/**
 * A customer's points.
 *
 * "Never earned" is a 404 from the backend, not an error — it renders as a
 * plain empty state. Manual adjustments sit behind `loyalty:adjust`; points
 * are a liability on the shop's books, so every correction carries a reason.
 */
export function LoyaltyTab({ customerId }: { customerId: string }) {
  const { can } = usePermission();
  const program = useLoyaltyProgram();
  const history = useLoyaltyHistory(customerId);
  const [adjusting, setAdjusting] = useState(false);

  const label = program.data?.points_label ?? "points";
  const canAdjust = can("loyalty:adjust") && !!program.data;

  if (program.isLoading || history.isLoading) return <Skeleton className="h-24 w-full" />;

  // A 404 on either is an answer ("no programme", "never earned"); anything
  // else is a failure, and mustn't read as "this business has no programme".
  const failed = [program, history].find((query) => query.isError && !isNotFound(query.error));
  if (failed) return <LoadError what="loyalty points" onRetry={() => failed.refetch()} />;

  if (!program.data) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        This business isn&apos;t running a loyalty programme.
      </p>
    );
  }

  const account = history.data?.account;

  const columns: DataTableColumn<LoyaltyTransaction>[] = [
    { key: "when", header: "When", render: (entry) => formatDateTime(entry.occurred_at) },
    { key: "kind", header: "Entry", render: (entry) => humanize(entry.kind) },
    { key: "note", header: "Note", render: (entry) => entry.note ?? "—" },
    {
      key: "expires",
      header: "Expires",
      render: (entry) => (entry.expires_on ? formatDate(entry.expires_on) : "—"),
    },
    {
      key: "points",
      header: humanize(label),
      align: "end",
      render: (entry) => (
        <span className={entry.points < 0 ? "text-destructive" : "text-success"}>
          {entry.points > 0 ? "+" : ""}
          {formatQuantity(String(entry.points))}
        </span>
      ),
    },
    {
      key: "balance",
      header: "Balance",
      align: "end",
      render: (entry) => formatQuantity(String(entry.balance_after)),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={`${humanize(label)} balance`} value={account?.points_balance} />
        <Stat label="Earned, lifetime" value={account?.lifetime_earned} />
        <Stat label="Redeemed, lifetime" value={account?.lifetime_redeemed} />
      </div>

      {canAdjust && (
        <div className="flex justify-end">
          <Button variant="outline" onClick={() => setAdjusting(true)}>
            Adjust {label}
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={history.data?.transactions ?? []}
        rowKey={(entry) => entry.id}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">
            No {label} earned yet — they start with the next sale.
          </p>
        }
        mobileCardTitle={(entry) => humanize(entry.kind)}
        mobileCardSubtitle={(entry) => formatDateTime(entry.occurred_at)}
        mobileCardFields={[
          { key: "points", label: humanize(label), render: (entry) => String(entry.points) },
        ]}
      />

      <AdjustPointsDialog
        open={adjusting}
        onOpenChange={setAdjusting}
        customerId={customerId}
        label={label}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">
        {value === undefined ? "0" : formatQuantity(String(value))}
      </p>
    </div>
  );
}

function AdjustPointsDialog({
  open,
  onOpenChange,
  customerId,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  label: string;
}) {
  const adjust = useAdjustLoyaltyPoints();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust {label}</DialogTitle>
          <DialogDescription>
            Use a negative number to take {label} away. The reason is kept on their history.
          </DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{ points: "", reason: "" }}
          enableReinitialize
          validationSchema={Yup.object({
            points: Yup.number()
              .transform((value, original) => (original === "" ? undefined : value))
              .required("Enter how many")
              .integer("Whole numbers only")
              .notOneOf([0], "Zero changes nothing"),
            reason: Yup.string().trim().required("Say why"),
          })}
          onSubmit={async (values, helpers) => {
            try {
              await adjust.mutateAsync([
                customerId,
                { points: Number(values.points), reason: values.reason.trim() },
              ]);
              toast.success("Balance adjusted");
              helpers.resetForm();
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
            <Form className="flex flex-col gap-4">
              <FormNumberField name="points" label={humanize(label)} step={1} autoFocus />
              <FormTextField name="reason" label="Reason" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Adjust
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
