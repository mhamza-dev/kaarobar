"use client";

import { format } from "date-fns";
import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useCancelFollowUp,
  useCompleteFollowUp,
  useCreateFollowUp,
  useCustomerSearch,
  useFollowUps,
} from "@/hooks/queries/useCustomers";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDate, humanize } from "@/lib/format";
import { FOLLOW_UP_KINDS, type FollowUp } from "@/types/api/crm";

/**
 * Follow-ups — the customer page's tab and the global "what needs doing"
 * list are the same table, one scoped by `customerId` and one not.
 *
 * `overdue` comes from the server (computed against its today), so a
 * browser in another timezone can't disagree about what is late.
 */
export function FollowUpsList({
  customerId,
  showCustomer = false,
}: {
  customerId?: string;
  showCustomer?: boolean;
}) {
  const { can } = usePermission();
  const canManage = can("follow_up:manage");

  const [status, setStatus] = useState("open");
  const [dueOnly, setDueOnly] = useState(false);
  const [creating, setCreating] = useState(false);
  const [completing, setCompleting] = useState<FollowUp | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");
  const { data, isLoading, error, refetch } = useFollowUps({
    // The backend defaults a missing status to "open", so "everything" has
    // to be asked for by name.
    status,
    customer_id: customerId,
    // `due_on <= due_before` on the backend — exactly "due by today".
    due_before: dueOnly ? today : undefined,
  });
  const cancel = useCancelFollowUp();

  const columns: DataTableColumn<FollowUp>[] = [
    {
      key: "title",
      header: "Follow-up",
      render: (task) => (
        <div>
          <p className="font-medium">{task.title}</p>
          {task.body && <p className="line-clamp-1 text-xs text-muted-foreground">{task.body}</p>}
          {task.outcome && (
            <p className="line-clamp-1 text-xs text-muted-foreground">→ {task.outcome}</p>
          )}
        </div>
      ),
    },
    ...(showCustomer
      ? [
          {
            key: "customer",
            header: "Customer",
            render: (task: FollowUp) =>
              task.customer ? (
                <Link
                  href={`/customers/${task.customer_id}`}
                  className="text-brand-primary hover:underline"
                >
                  {task.customer.name}
                </Link>
              ) : (
                "—"
              ),
          },
        ]
      : []),
    { key: "kind", header: "Kind", render: (task) => humanize(task.kind) },
    {
      key: "due",
      header: "Due",
      render: (task) => (
        <span className={task.overdue ? "font-medium text-destructive" : undefined}>
          {formatDate(task.due_on)}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (task) => (
        <StatusBadge status={task.overdue && task.status === "open" ? "overdue" : task.status} />
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-40",
      render: (task) =>
        canManage && task.status === "open" ? (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="sm" onClick={() => setCompleting(task)}>
              Done
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={cancel.isPending}
              onClick={async () => {
                try {
                  await cancel.mutateAsync([task.id]);
                  toast.success("Follow-up cancelled");
                } catch {
                  // Toasted by the hook.
                }
              }}
            >
              Cancel
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="open">Open</option>
            <option value="done">Done</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={dueOnly}
              onChange={(event) => setDueOnly(event.target.checked)}
            />
            Due by today
          </label>
        </div>
        {canManage && customerId && (
          <Button variant="outline" onClick={() => setCreating(true)}>
            New follow-up
          </Button>
        )}
        {canManage && !customerId && (
          <Button onClick={() => setCreating(true)}>New follow-up</Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(task) => task.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={
          <p className="p-6 text-center text-sm text-muted-foreground">Nothing to follow up on.</p>
        }
        mobileCardTitle={(task) => task.title}
        mobileCardSubtitle={(task) => task.customer?.name ?? humanize(task.kind)}
        mobileCardFields={[{ key: "due", label: "Due", render: (task) => formatDate(task.due_on) }]}
        mobileCardActions={(task) =>
          canManage && task.status === "open" ? (
            <Button variant="outline" size="sm" onClick={() => setCompleting(task)}>
              Done
            </Button>
          ) : null
        }
      />

      <FollowUpDialog open={creating} onOpenChange={setCreating} customerId={customerId} />
      <CompleteFollowUpDialog task={completing} onOpenChange={() => setCompleting(null)} />
    </>
  );
}

const createSchema = Yup.object({
  customer_id: Yup.string().required("Pick a customer"),
  title: Yup.string().trim().required("Say what needs doing"),
  due_on: Yup.string().required("Pick a due date"),
});

export function FollowUpDialog({
  open,
  onOpenChange,
  customerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed on a customer page; picked in the dialog on the global list. */
  customerId?: string;
}) {
  const create = useCreateFollowUp();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const customers = useCustomerSearch(debouncedQuery, open && !customerId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New follow-up</DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{
            customer_id: customerId ?? "",
            title: "",
            kind: "call",
            due_on: format(new Date(), "yyyy-MM-dd"),
            body: "",
          }}
          enableReinitialize
          validationSchema={createSchema}
          onSubmit={async (values, helpers) => {
            try {
              await create.mutateAsync([
                values.customer_id,
                {
                  title: values.title,
                  kind: values.kind,
                  due_on: values.due_on,
                  body: values.body || undefined,
                },
              ]);
              toast.success("Follow-up added");
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
              {!customerId && (
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
                  onSearchChange={setQuery}
                  loading={customers.isFetching}
                />
              )}
              <FormTextField name="title" label="What needs doing" autoFocus={!!customerId} />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelectField
                  name="kind"
                  label="Kind"
                  options={FOLLOW_UP_KINDS.map((kind) => ({ value: kind, label: humanize(kind) }))}
                />
                <FormDatePicker name="due_on" label="Due" />
              </div>
              <FormTextareaField name="body" label="Details" rows={2} />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Add follow-up
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}

/** The outcome is required by the backend: the next person to call needs to know what was agreed. */
function CompleteFollowUpDialog({
  task,
  onOpenChange,
}: {
  task: FollowUp | null;
  onOpenChange: (open: boolean) => void;
}) {
  const complete = useCompleteFollowUp();

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Close follow-up</DialogTitle>
          <DialogDescription>{task?.title}</DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{ outcome: "" }}
          enableReinitialize
          validationSchema={Yup.object({
            outcome: Yup.string().trim().required("Say what came of it"),
          })}
          onSubmit={async (values, helpers) => {
            if (!task) return;
            try {
              await complete.mutateAsync([task.id, values.outcome.trim()]);
              toast.success("Follow-up closed");
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
              <FormTextareaField
                name="outcome"
                label="Outcome"
                rows={3}
                placeholder="Promised to pay Friday…"
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Mark done
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
