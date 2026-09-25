"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormCheckbox } from "@/components/forms/FormCheckbox";
import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormTextField } from "@/components/forms/FormTextField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useDeleteTimeEntry,
  useLogTime,
  useTimeEntries,
  useUnbilledTime,
  useUtilisation,
} from "@/hooks/queries/useOperations";
import { useStaffList } from "@/hooks/queries/useStaff";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDate, formatMoney, todayIso } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { TimeEntry, UtilisationRow } from "@/types/api/operations";

const hours = (minutes: number) =>
  `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;

function useStaffNames() {
  const { data } = useStaffList();
  return new Map(
    (data ?? []).flatMap((member) =>
      member.user ? [[member.user.id, member.user.name ?? member.user.email]] : [],
    ),
  );
}

/** Time worked for clients: what's logged, what's still to bill, and who's busy. */
export function TimeScreen() {
  return (
    <Tabs defaultValue="entries">
      <TabsList variant="line">
        <TabsTrigger value="entries">Time logged</TabsTrigger>
        <TabsTrigger value="utilisation">By person</TabsTrigger>
      </TabsList>
      <TabsContent value="entries" className="pt-4">
        <Entries />
      </TabsContent>
      <TabsContent value="utilisation" className="pt-4">
        <Utilisation />
      </TabsContent>
    </Tabs>
  );
}

function Entries() {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const names = useStaffNames();
  const { data, isLoading, error, refetch } = useTimeEntries();
  const { data: unbilled } = useUnbilledTime();
  const remove = useDeleteTimeEntry();

  const columns: DataTableColumn<TimeEntry>[] = [
    {
      key: "what",
      header: "Work",
      render: (entry) => (
        <div>
          <p className="font-medium">{entry.description}</p>
          <p className="text-xs text-muted-foreground">
            {names.get(entry.user_id) ?? "Someone"} · {formatDate(entry.worked_on)}
          </p>
        </div>
      ),
    },
    { key: "time", header: "Time", align: "end", render: (entry) => hours(entry.minutes) },
    {
      key: "billing",
      header: "",
      render: (entry) =>
        !entry.is_billable ? (
          <Badge variant="outline">Not billable</Badge>
        ) : entry.unbilled ? (
          <Badge variant="secondary">To bill</Badge>
        ) : (
          <Badge variant="outline">Billed</Badge>
        ),
    },
    {
      key: "amount",
      header: "Worth",
      align: "end",
      render: (entry) => formatMoney(entry.amount, currency),
    },
    ...(can("time_entry:record")
      ? [
          {
            key: "actions",
            header: "",
            align: "end" as const,
            render: (entry: TimeEntry) =>
              entry.unbilled || !entry.is_billable ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={remove.isPending}
                  onClick={async () => {
                    try {
                      await remove.mutateAsync([entry.id]);
                      toast.success("Time removed");
                    } catch {
                      // Toasted by the hook.
                    }
                  }}
                >
                  Remove
                </Button>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      {unbilled && (
        <div className="grid max-w-md grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Not yet billed</p>
            <p className="text-lg font-semibold tabular-nums">{hours(unbilled.minutes)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Worth</p>
            <p className="text-lg font-semibold tabular-nums">
              {formatMoney(unbilled.amount, currency)}
            </p>
          </div>
        </div>
      )}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(entry) => entry.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={<p className="p-6 text-center text-sm text-muted-foreground">No time logged yet.</p>}
        mobileCardTitle={(entry) => entry.description}
        mobileCardFields={[{ key: "time", label: "Time", render: (entry) => hours(entry.minutes) }]}
      />
    </div>
  );
}

function Utilisation() {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const names = useStaffNames();
  const [from, setFrom] = useState(`${todayIso().slice(0, 8)}01`);
  const [to, setTo] = useState(todayIso());
  const { data, isLoading, error, refetch } = useUtilisation(from, to);

  const columns: DataTableColumn<UtilisationRow>[] = [
    { key: "who", header: "Person", render: (row) => names.get(row.user_id) ?? "Someone" },
    {
      key: "billable",
      header: "Billable",
      align: "end",
      render: (row) => hours(row.billable_minutes),
    },
    {
      key: "other",
      header: "Not billable",
      align: "end",
      render: (row) => hours(row.non_billable_minutes),
    },
    {
      key: "share",
      header: "Billable share",
      align: "end",
      render: (row) => {
        const total = row.billable_minutes + row.non_billable_minutes;
        return total ? `${Math.round((row.billable_minutes / total) * 100)}%` : "—";
      },
    },
    {
      key: "amount",
      header: "Worth",
      align: "end",
      render: (row) => formatMoney(row.amount, currency),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="time-from">From</Label>
          <Input
            id="time-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="time-to">To</Label>
          <Input
            id="time-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.user_id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">
            No time logged in this period.
          </p>
        }
        mobileCardTitle={(row) => names.get(row.user_id) ?? "Someone"}
        mobileCardFields={[
          { key: "billable", label: "Billable", render: (row) => hours(row.billable_minutes) },
        ]}
      />
    </div>
  );
}

const schema = Yup.object({
  description: Yup.string().trim().required("Say what the work was"),
  hours: Yup.number().typeError("Enter hours").min(0),
  minutes: Yup.number().typeError("Enter minutes").min(0).max(59),
  worked_on: Yup.string().required(),
});

export function LogTimeDialog() {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [open, setOpen] = useState(false);
  const log = useLogTime();

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        Log time
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log time</DialogTitle>
            <DialogDescription>
              Billable time waits to go on the client&apos;s next invoice.
            </DialogDescription>
          </DialogHeader>
          <Formik
            initialValues={{
              description: "",
              hours: "1",
              minutes: "0",
              worked_on: todayIso(),
              is_billable: true,
              hourly_rate: "",
            }}
            validationSchema={schema}
            onSubmit={async (values, helpers) => {
              const minutes = Number(values.hours || 0) * 60 + Number(values.minutes || 0);
              if (minutes <= 0) {
                helpers.setFieldError("hours", "Log some time");
                return;
              }
              try {
                await log.mutateAsync([
                  {
                    description: values.description,
                    worked_on: values.worked_on,
                    minutes: Math.round(minutes),
                    is_billable: values.is_billable,
                    ...(values.hourly_rate ? { hourly_rate: String(values.hourly_rate) } : {}),
                  },
                ]);
                toast.success("Time logged");
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
            {({ isSubmitting, values }) => (
              <Form className="flex flex-col gap-4">
                <FormTextField
                  name="description"
                  label="Work"
                  placeholder="Drafted the lease review"
                />
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormNumberField name="hours" label="Hours" min={0} />
                  <FormNumberField name="minutes" label="Minutes" min={0} max={59} />
                  <FormDatePicker name="worked_on" label="On" max={todayIso()} />
                </div>
                <FormCheckbox name="is_billable" label="Billable to the client" />
                {values.is_billable && (
                  <FormNumberField
                    name="hourly_rate"
                    label="Hourly rate"
                    min={0}
                    suffix={currency}
                    hint="Blank uses the usual rate."
                  />
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Log time
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
