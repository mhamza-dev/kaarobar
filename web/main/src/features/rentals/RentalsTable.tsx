"use client";

import { format } from "date-fns";
import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useCustomerSearch } from "@/hooks/queries/useCustomers";
import { useAvailableUnits, useBookRental, useRentals } from "@/hooks/queries/useRentals";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { RentalAgreement } from "@/types/api/rentals";

export function RentalsTable() {
  const router = useRouter();
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [status, setStatus] = useState("");
  const [booking, setBooking] = useState(false);
  const { data, isLoading, error, refetch } = useRentals({ status: status || undefined });

  const columns: DataTableColumn<RentalAgreement>[] = [
    {
      key: "number",
      header: "Hire",
      render: (hire) => <span className="font-medium">{hire.number}</span>,
    },
    { key: "customer", header: "Customer", render: (hire) => hire.customer?.name ?? "—" },
    { key: "from", header: "Out", render: (hire) => formatDateTime(hire.starts_at) },
    {
      key: "due",
      header: "Due back",
      render: (hire) => (
        <span className={hire.days_late ? "font-medium text-destructive" : undefined}>
          {formatDateTime(hire.due_back_at)}
          {hire.days_late ? ` · ${hire.days_late}d late` : ""}
        </span>
      ),
    },
    { key: "status", header: "Status", render: (hire) => <StatusBadge status={hire.status} /> },
    {
      key: "total",
      header: "Total due",
      align: "end",
      render: (hire) => formatMoney(hire.total_due, currency),
    },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filter by status"
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          {/* No status means "still out" on the backend (Agreement.out_statuses). */}
          <option value="">Out now</option>
          <option value="reserved">Reserved</option>
          <option value="on_hire">On hire</option>
          <option value="overdue">Overdue</option>
          <option value="returned">Returned</option>
          <option value="cancelled">Cancelled</option>
          <option value="all">All hires</option>
        </select>
        {can("rental:manage") && (
          <Button onClick={() => setBooking(true)}>
            <Plus className="size-4" />
            New hire
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(hire) => hire.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (hire) => `${hire.number} ${hire.customer?.name ?? ""}` }}
        onRowClick={(hire) => router.push(`/rentals/${hire.id}`)}
        mobileCardTitle={(hire) => hire.number}
        mobileCardSubtitle={(hire) => hire.customer?.name ?? ""}
        mobileCardFields={[
          { key: "due", label: "Due back", render: (hire) => formatDateTime(hire.due_back_at) },
        ]}
      />
      <BookRentalDialog
        open={booking}
        onOpenChange={setBooking}
        onBooked={(id) => router.push(`/rentals/${id}`)}
      />
    </>
  );
}

/**
 * Booking a hire: who, when, and which units — offered only from what is
 * free for the whole period (`GET /rentals/available`), since the backend's
 * exclusion constraint would refuse anything else anyway. Totals come back
 * computed from the rates and the dates.
 */
function BookRentalDialog({
  open,
  onOpenChange,
  onBooked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBooked: (id: string) => void;
}) {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const book = useBookRental();
  const [customerQuery, setCustomerQuery] = useState("");
  const customers = useCustomerSearch(useDebounce(customerQuery, 300), open);
  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New hire</DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{
            customer_id: "",
            starts_at: today,
            due_back_at: "",
            unit_ids: [] as string[],
            notes: "",
          }}
          validationSchema={Yup.object({
            customer_id: Yup.string().required("A hire needs a customer"),
            due_back_at: Yup.string().required("When is it due back?"),
            unit_ids: Yup.array().min(1, "Pick at least one unit"),
          })}
          onSubmit={async (values, helpers) => {
            try {
              const hire = await book.mutateAsync([
                {
                  customer_id: values.customer_id,
                  starts_at: new Date(`${values.starts_at}T09:00`).toISOString(),
                  due_back_at: new Date(`${values.due_back_at}T18:00`).toISOString(),
                  unit_ids: values.unit_ids,
                  notes: values.notes || undefined,
                },
              ]);
              toast.success(`Hire ${hire.number} booked`);
              onOpenChange(false);
              onBooked(hire.id);
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
          {({ isSubmitting, values, setFieldValue, errors, touched }) => (
            <Form className="flex flex-col gap-4">
              <FormSearchSelectField
                name="customer_id"
                label="Customer"
                placeholder="Pick a customer"
                searchPlaceholder="Search name or phone…"
                options={(customers.data ?? []).map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                  description: customer.phone ?? undefined,
                }))}
                onSearchChange={setCustomerQuery}
                loading={customers.isFetching}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormDatePicker name="starts_at" label="Out" min={today} />
                <FormDatePicker name="due_back_at" label="Due back" min={values.starts_at} />
              </div>
              <AvailableUnits
                from={values.starts_at}
                to={values.due_back_at}
                selected={values.unit_ids}
                currency={currency}
                onChange={(ids) => setFieldValue("unit_ids", ids)}
              />
              {touched.unit_ids && typeof errors.unit_ids === "string" && (
                <p className="text-xs text-destructive">{errors.unit_ids}</p>
              )}
              <FormTextField name="notes" label="Notes" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Book hire
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}

function AvailableUnits({
  from,
  to,
  selected,
  currency,
  onChange,
}: {
  from: string;
  to: string;
  selected: string[];
  currency: string;
  onChange: (ids: string[]) => void;
}) {
  const fromAt = from ? new Date(`${from}T09:00`).toISOString() : "";
  const toAt = to ? new Date(`${to}T18:00`).toISOString() : "";
  const { data: units, isFetching } = useAvailableUnits(fromAt, toAt);

  if (!from || !to) {
    return <p className="text-xs text-muted-foreground">Pick the dates to see what&apos;s free.</p>;
  }
  if (isFetching && !units) {
    return <p className="text-xs text-muted-foreground">Checking what&apos;s free…</p>;
  }
  if ((units ?? []).length === 0) {
    return <p className="text-xs text-destructive">Nothing is free for those dates.</p>;
  }

  return (
    <fieldset className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-lg border border-border p-3">
      <legend className="px-1 text-sm font-medium">Units</legend>
      {(units ?? []).map((unit) => {
        const id = `unit-${unit.id}`;
        return (
          <div key={unit.id} className="flex items-center justify-between gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Checkbox
                id={id}
                checked={selected.includes(unit.id)}
                onCheckedChange={(checked) =>
                  onChange(
                    checked === true
                      ? [...selected, unit.id]
                      : selected.filter((value) => value !== unit.id),
                  )
                }
              />
              <Label htmlFor={id} className="font-normal">
                {unit.asset_code}
              </Label>
            </div>
            <span className="text-xs text-muted-foreground">
              {formatMoney(unit.daily_rate, currency)}/day
            </span>
          </div>
        );
      })}
    </fieldset>
  );
}
