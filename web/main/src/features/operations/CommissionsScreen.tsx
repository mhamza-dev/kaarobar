"use client";

import { Form, Formik } from "formik";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { EmptyState } from "@/components/shared/EmptyState";
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
import { PageActions } from "@/components/shared/PageActions";
import { useCategoriesList } from "@/hooks/queries/useCategories";
import {
  useApproveCommissions,
  useCommissionRules,
  useCommissionStatement,
  useCommissionSummary,
  useCreateCommissionRule,
  useDeleteCommissionRule,
  usePayCommissions,
} from "@/hooks/queries/useOperations";
import { useStaffList } from "@/hooks/queries/useStaff";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import {
  formatDate,
  formatMoney,
  fractionToPercent,
  humanize,
  percentToFraction,
  todayIso,
} from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import {
  COMMISSION_BASES,
  type CommissionEntry,
  type CommissionRule,
} from "@/types/api/operations";

const BASIS_LABELS: Record<string, string> = {
  percent_of_net: "% of the sale",
  percent_of_margin: "% of the margin",
  flat_per_item: "A fixed amount per item",
};

function monthStart() {
  const today = todayIso();
  return `${today.slice(0, 8)}01`;
}

function useStaffNames() {
  const { data } = useStaffList();
  return new Map(
    (data ?? []).flatMap((member) =>
      member.user ? [[member.user.id, member.user.name ?? member.user.email]] : [],
    ),
  );
}

/** What staff have earned on their sales, and the rules that decide it. */
export function CommissionsScreen() {
  return (
    <Tabs defaultValue="earned">
      <TabsList variant="line">
        <TabsTrigger value="earned">Earned</TabsTrigger>
        <TabsTrigger value="rules">Rules</TabsTrigger>
      </TabsList>
      <TabsContent value="earned" className="pt-4">
        <Earned />
      </TabsContent>
      <TabsContent value="rules" className="pt-4">
        <Rules />
      </TabsContent>
    </Tabs>
  );
}

function Earned() {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const names = useStaffNames();
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(todayIso());
  const [person, setPerson] = useState<string | null>(null);
  const { data, isLoading, error, refetch } = useCommissionSummary(from, to);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commission-from">From</Label>
          <Input
            id="commission-from"
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="commission-to">To</Label>
          <Input
            id="commission-to"
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </div>
      </div>
      {error ? (
        <LoadError what="the commissions" onRetry={() => refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <DataTable
          columns={[
            { key: "who", header: "Staff", render: (row) => names.get(row.user_id) ?? "Someone" },
            { key: "lines", header: "Sales lines", align: "end", render: (row) => row.line_count },
            {
              key: "amount",
              header: "Owed",
              align: "end",
              render: (row) => (
                <span className="font-medium">{formatMoney(row.amount, currency)}</span>
              ),
            },
          ]}
          rows={data ?? []}
          rowKey={(row) => row.user_id}
          onRowClick={(row) => setPerson(row.user_id)}
          empty={<EmptyState size="sm" title={<>No commission earned in this period.</>} />}
          mobileCardTitle={(row) => names.get(row.user_id) ?? "Someone"}
          mobileCardFields={[
            { key: "amount", label: "Owed", render: (row) => formatMoney(row.amount, currency) },
          ]}
        />
      )}
      {person && (
        <Statement
          userId={person}
          name={names.get(person) ?? "Someone"}
          from={from}
          to={to}
          currency={currency}
          onClose={() => setPerson(null)}
        />
      )}
    </div>
  );
}

/**
 * One person's lines: "why is my commission short?" is answered by which
 * sales it came from. Approve lines, then mark them paid.
 */
function Statement({
  userId,
  name,
  from,
  to,
  currency,
  onClose,
}: {
  userId: string;
  name: string;
  from: string;
  to: string;
  currency: string;
  onClose: () => void;
}) {
  const { can } = usePermission();
  const { data, isLoading, error, refetch } = useCommissionStatement(userId, from, to);
  const approve = useApproveCommissions();
  const pay = usePayCommissions();
  const money = (value: string | null | undefined) => formatMoney(value, currency);

  // Approve takes accrued lines; pay takes approved ones. Anything else
  // selected is left alone rather than sent to be refused.
  const run = async (kind: "approve" | "pay", rows: CommissionEntry[], clear: () => void) => {
    const ids = rows
      .filter((entry) =>
        kind === "approve" ? entry.status === "accrued" : entry.status === "approved",
      )
      .map((entry) => entry.id);
    if (ids.length === 0) {
      toast.error(
        kind === "approve" ? "Pick lines still to approve" : "Pick approved lines to pay",
      );
      return;
    }
    try {
      await (kind === "approve" ? approve : pay).mutateAsync([ids]);
      toast.success(
        `${ids.length} line${ids.length === 1 ? "" : "s"} ${kind === "approve" ? "approved" : "marked paid"}`,
      );
      clear();
    } catch {
      // Toasted by the hook.
    }
  };

  const columns: DataTableColumn<CommissionEntry>[] = [
    { key: "when", header: "Earned", render: (entry) => formatDate(entry.earned_on) },
    {
      key: "basis",
      header: "On",
      render: (entry) =>
        `${BASIS_LABELS[entry.basis] ?? humanize(entry.basis)} of ${money(entry.base_amount)}`,
    },
    { key: "status", header: "Status", render: (entry) => <StatusBadge status={entry.status} /> },
    { key: "amount", header: "Amount", align: "end", render: (entry) => money(entry.amount) },
  ];

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{name}</h3>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
      {error ? (
        <LoadError what="the statement" onRetry={() => refetch()} />
      ) : isLoading || !data ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <>
          <DescriptionList
            layout="inline"
            items={[
              { label: "Earned", value: money(data.earned) },
              { label: "Reversed", value: money(data.reversed) },
              { label: "Paid", value: money(data.paid) },
            ]}
          />
          <DataTable
            embedded
            columns={columns}
            rows={data.entries}
            rowKey={(entry) => entry.id}
            selectable={can("commission:pay")}
            isRowSelectable={(entry) => ["accrued", "approved"].includes(entry.status)}
            bulkActions={({ rows, clear }) => (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={approve.isPending}
                  onClick={() => run("approve", rows, clear)}
                >
                  Approve
                </Button>
                <Button size="sm" disabled={pay.isPending} onClick={() => run("pay", rows, clear)}>
                  Mark paid
                </Button>
              </>
            )}
            empty={<EmptyState size="sm" title={<>Nothing earned in this period.</>} />}
            mobileCardTitle={(entry) => money(entry.amount)}
            mobileCardSubtitle={(entry) => formatDate(entry.earned_on)}
          />
        </>
      )}
    </section>
  );
}

function Rules() {
  const { can } = usePermission();
  const canManage = can("commission:manage");
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const names = useStaffNames();
  const { data, isLoading, error, refetch } = useCommissionRules();
  const remove = useDeleteCommissionRule();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<CommissionRule | null>(null);

  const columns: DataTableColumn<CommissionRule>[] = [
    {
      key: "name",
      header: "Rule",
      render: (rule) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{rule.name}</span>
          {!rule.is_active && <Badge variant="outline">Off</Badge>}
        </div>
      ),
    },
    {
      key: "who",
      header: "For",
      render: (rule) => (rule.user_id ? (names.get(rule.user_id) ?? "One person") : "Everyone"),
    },
    {
      key: "rate",
      header: "Pays",
      render: (rule) =>
        rule.basis === "flat_per_item"
          ? `${formatMoney(rule.flat_amount, currency)} per item`
          : `${fractionToPercent(rule.rate)}${BASIS_LABELS[rule.basis] ?? ""}`,
    },
    ...(canManage
      ? [
          {
            key: "actions",
            header: "",
            align: "end" as const,
            render: (rule: CommissionRule) => (
              <Button variant="ghost" size="sm" onClick={() => setDeleting(rule)}>
                Delete
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      {canManage && (
        <PageActions>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New rule
          </Button>
        </PageActions>
      )}
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(rule) => rule.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        empty={
          <EmptyState size="sm" title={<>No commission rules — nobody earns commission yet.</>} />
        }
        mobileCardTitle={(rule) => rule.name}
      />
      <RuleDialog open={creating} onOpenChange={setCreating} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        description="Commission already earned under it stays. New sales stop earning by it."
        confirmLabel="Delete rule"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync([deleting!.id]);
            toast.success("Rule deleted");
            setDeleting(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}

function RuleDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: staff } = useStaffList();
  const { data: categories } = useCategoriesList();
  const create = useCreateCommissionRule();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New commission rule</DialogTitle>
          <DialogDescription>
            The most specific rule that matches a sale line is the one that pays.
          </DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{
            name: "",
            basis: "percent_of_net",
            rate: "",
            flat_amount: "",
            user_id: "",
            category_id: "",
          }}
          validationSchema={Yup.object({ name: Yup.string().trim().required("Name the rule") })}
          onSubmit={async (values, helpers) => {
            const flat = values.basis === "flat_per_item";
            try {
              await create.mutateAsync([
                {
                  name: values.name,
                  basis: values.basis,
                  rate: flat ? null : percentToFraction(values.rate),
                  flat_amount: flat ? String(values.flat_amount) : null,
                  user_id: values.user_id || null,
                  category_id: values.category_id || null,
                },
              ]);
              toast.success("Rule added");
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
          {({ isSubmitting, values }) => (
            <Form className="grid gap-4 sm:grid-cols-2">
              <FormTextField
                name="name"
                label="Name"
                placeholder="Stylists — services"
                className="sm:col-span-2"
              />
              <FormSelectField
                name="basis"
                label="Pays"
                options={COMMISSION_BASES.map((value) => ({ value, label: BASIS_LABELS[value] }))}
              />
              {values.basis === "flat_per_item" ? (
                <FormNumberField name="flat_amount" label="Amount" min={0} suffix={currency} />
              ) : (
                <FormNumberField name="rate" label="Rate" min={0} max={100} suffix="%" />
              )}
              <FormSelectField
                name="user_id"
                label="For"
                placeholder="Everyone"
                options={(staff ?? []).flatMap((member) =>
                  member.user
                    ? [{ value: member.user.id, label: member.user.name ?? member.user.email }]
                    : [],
                )}
              />
              <FormSelectField
                name="category_id"
                label="On"
                placeholder="Everything"
                options={(categories ?? []).map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
              />
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Add rule
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
