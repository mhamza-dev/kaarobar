"use client";

import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormTextField } from "@/components/forms/FormTextField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddServiceJobNote,
  useCancelServiceJob,
  useDeliverServiceJob,
  useHoldServiceJob,
  useMarkServiceJobReady,
  useServiceJob,
  useServiceJobHistory,
  useStartServiceJob,
} from "@/hooks/queries/useServiceJobs";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDate, formatDateTime, formatMoney, formatQuantity, humanize } from "@/lib/format";
import { canTransitionJob } from "@/lib/serviceJobs";
import { useSessionStore } from "@/stores/sessionStore";
import type { JobItem } from "@/types/api/serviceJobs";

/** One job: its items, what has happened to it, and the next step. */
export function ServiceJobDetail({ jobId }: { jobId: string }) {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: job, isLoading, isError } = useServiceJob(jobId);
  const { data: history } = useServiceJobHistory(jobId);
  const start = useStartServiceJob();
  const deliver = useDeliverServiceJob();
  const hold = useHoldServiceJob();
  const cancel = useCancelServiceJob();
  const addNote = useAddServiceJobNote();
  const [markingReady, setMarkingReady] = useState(false);
  const [reasonFor, setReasonFor] = useState<"hold" | "cancel" | null>(null);
  const [note, setNote] = useState("");

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !job) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load this job.</p>;
  }

  const balanceDue = Number(job.balance_due ?? 0) > 0;
  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
    } catch {
      // Toasted by the hook.
    }
  };

  const actions: WorkflowAction[] = [
    {
      key: "start",
      label: job.status === "on_hold" ? "Resume" : "Start work",
      variant: "default",
      available: canTransitionJob(job.status, "start"),
      permitted: can("service_job:update"),
      pending: start.isPending,
      onAction: () => run(() => start.mutateAsync([job.id]), "Work started"),
    },
    {
      key: "ready",
      label: "Mark ready",
      variant: "default",
      available: canTransitionJob(job.status, "ready"),
      permitted: can("service_job:update"),
      onAction: () => setMarkingReady(true),
    },
    {
      key: "deliver",
      label: balanceDue ? "Hand back unpaid" : "Hand back",
      variant: balanceDue ? "outline" : "default",
      available: canTransitionJob(job.status, "deliver"),
      permitted: can("service_job:deliver"),
      pending: deliver.isPending,
      // Handing over work with money still owed is allowed, but only on
      // purpose — the backend refuses it without `allow_unpaid`.
      confirm: balanceDue
        ? {
            title: "Hand back without payment?",
            description: `${formatMoney(job.balance_due, currency)} is still due on this job.`,
            confirmLabel: "Hand back unpaid",
            destructive: true,
          }
        : undefined,
      onAction: () => run(() => deliver.mutateAsync([job.id, balanceDue]), "Handed back"),
    },
    {
      key: "hold",
      label: "Put on hold",
      available: canTransitionJob(job.status, "hold"),
      permitted: can("service_job:update"),
      pending: hold.isPending,
      onAction: () => setReasonFor("hold"),
    },
    {
      key: "cancel",
      label: "Cancel job",
      available: canTransitionJob(job.status, "cancel"),
      permitted: can("service_job:update"),
      pending: cancel.isPending,
      onAction: () => setReasonFor("cancel"),
    },
  ];

  const itemColumns: DataTableColumn<JobItem>[] = [
    {
      key: "item",
      header: "Item",
      render: (item) => (
        <div>
          <p className="font-medium">{item.label ?? item.description}</p>
          {item.condition_notes && (
            <p className="text-xs text-muted-foreground">{item.condition_notes}</p>
          )}
        </div>
      ),
    },
    { key: "tag", header: "Tag", render: (item) => item.tag_code ?? "—" },
    { key: "qty", header: "Qty", align: "end", render: (item) => formatQuantity(item.quantity) },
    { key: "status", header: "Status", render: (item) => <StatusBadge status={item.status} /> },
    {
      key: "total",
      header: "Price",
      align: "end",
      render: (item) => formatMoney(item.line_total, currency),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{job.number}</h2>
            <StatusBadge
              status={job.overdue && job.status !== "delivered" ? "overdue" : job.status}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {job.who ?? "Walk-in"}
            {job.walk_in_phone && ` · ${job.walk_in_phone}`} · promised{" "}
            {formatDate(job.promised_on)}
            {job.rack_location && ` · rack ${job.rack_location}`}
          </p>
        </div>
        <WorkflowActions actions={actions} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Figure label="Quoted" value={formatMoney(job.quoted_total, currency)} />
        <Figure label="Advance paid" value={formatMoney(job.advance_paid, currency)} />
        <Figure label="Balance due" value={formatMoney(job.balance_due, currency)} />
      </div>

      <DataTable
        columns={itemColumns}
        rows={job.items ?? []}
        rowKey={(item) => item.id}
        mobileCardTitle={(item) => item.label ?? item.description ?? "Item"}
        mobileCardFields={[
          { key: "status", label: "Status", render: (item) => humanize(item.status) },
        ]}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">History</h2>
        {can("service_job:update") && (
          <form
            className="flex gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!note.trim()) return;
              try {
                await addNote.mutateAsync([job.id, note.trim()]);
                setNote("");
              } catch {
                // Toasted by the hook.
              }
            }}
          >
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Add a note — called the customer, waiting on a part…"
              aria-label="New note"
            />
            <Button type="submit" variant="outline" disabled={!note.trim() || addNote.isPending}>
              Add
            </Button>
          </form>
        )}
        <ol className="flex flex-col gap-2 border-l border-border pl-4">
          {(history ?? []).map((event) => (
            <li key={event.id} className="text-sm">
              <p>
                <span className="font-medium">{humanize(event.kind)}</span>
                {event.summary && ` — ${event.summary}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {event.actor_label ?? "System"} · {formatDateTime(event.occurred_at)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <ReadyDialog open={markingReady} onOpenChange={setMarkingReady} jobId={job.id} />
      <ReasonDialog
        open={reasonFor !== null}
        onOpenChange={(open) => !open && setReasonFor(null)}
        title={reasonFor === "cancel" ? `Cancel ${job.number}?` : `Put ${job.number} on hold?`}
        description={
          reasonFor === "cancel"
            ? "The customer's items still need handing back."
            : "It goes back to work with Resume."
        }
        placeholder={reasonFor === "cancel" ? "Customer changed their mind…" : "Waiting on a part…"}
        confirmLabel={reasonFor === "cancel" ? "Cancel job" : "Put on hold"}
        destructive={reasonFor === "cancel"}
        onSubmit={async (reason) => {
          if (reasonFor === "cancel") {
            await cancel.mutateAsync([job.id, reason]);
            toast.success("Job cancelled");
          } else {
            await hold.mutateAsync([job.id, reason]);
            toast.success("On hold");
          }
        }}
      />
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** A rack location is required — a ready job nobody can find isn't ready. */
function ReadyDialog({
  open,
  onOpenChange,
  jobId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
}) {
  const ready = useMarkServiceJobReady();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark ready</DialogTitle>
          <DialogDescription>Where is it waiting for collection?</DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{ rack_location: "" }}
          validationSchema={Yup.object({
            rack_location: Yup.string().trim().required("Say where it is"),
          })}
          onSubmit={async (values, helpers) => {
            try {
              await ready.mutateAsync([jobId, values.rack_location.trim()]);
              toast.success("Ready for collection");
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
              <FormTextField name="rack_location" label="Rack" placeholder="B-12" autoFocus />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Mark ready
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
