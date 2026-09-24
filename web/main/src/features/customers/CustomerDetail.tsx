"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useArchiveCustomer, useCustomer } from "@/hooks/queries/useCustomers";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { availableCreditLabel } from "@/lib/credit";
import { formatDate, formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";

import { AccountTab } from "./AccountTab";
import { AddressesTab } from "./AddressesTab";
import { CustomerDialog } from "./CustomerDialog";
import { FollowUpsList } from "./FollowUps";
import { LoyaltyTab } from "./LoyaltyTab";
import { NotesTab } from "./NotesTab";
import { RecordPaymentDialog } from "./RecordPaymentDialog";

/**
 * One customer: who they are, what they owe, and everything attached.
 *
 * Each tab appears only when the caller can open what it shows (the same
 * permissions the backend enforces per endpoint) and, for loyalty, only
 * when the business runs that module — a tab that could only ever render a
 * 403 is not a tab worth offering.
 */
export function CustomerDetail({ customerId }: { customerId: string }) {
  const router = useRouter();
  const { can } = usePermission();
  const business = useSessionStore((state) => state.scope?.business);
  const currency = business?.currency ?? "PKR";
  const modules = business?.modules ?? [];

  const { data: customer, isLoading, isError } = useCustomer(customerId);
  const archive = useArchiveCustomer();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (isError || !customer) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load this customer.</p>;
  }

  const canSeeCredit = can("credit:view");
  const canEdit = can("customer:edit");
  const showLoyalty = can("loyalty:view") && modules.includes("loyalty");
  const showFollowUps = can("follow_up:view");

  const actions: WorkflowAction[] = [
    {
      key: "payment",
      label: "Record payment",
      variant: "default",
      available: customer.credit_allowed || customer.owing,
      permitted: can("credit:payment"),
      onAction: () => setPaying(true),
    },
    {
      key: "edit",
      label: "Edit",
      available: true,
      permitted: canEdit,
      onAction: () => setEditing(true),
    },
    {
      key: "archive",
      label: "Archive",
      available: customer.is_active,
      permitted: can("customer:archive"),
      pending: archive.isPending,
      confirm: {
        title: `Archive ${customer.name}?`,
        description: customer.owing
          ? `They still owe ${formatMoney(customer.balance, currency)}. Their account stays; they won't appear at the till.`
          : "Their history stays. They won't appear at the till.",
        confirmLabel: "Archive customer",
        destructive: true,
      },
      onAction: async () => {
        try {
          await archive.mutateAsync([customer.id]);
          toast.success("Customer archived");
          router.push("/customers");
        } catch {
          // Toasted by the hook.
        }
      },
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{customer.name}</h2>
            {!customer.is_active && <Badge variant="outline">Archived</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[customer.phone, customer.email, customer.city].filter(Boolean).join(" · ") ||
              "No contact details"}
          </p>
          {customer.date_of_birth && (
            <p className="text-xs text-muted-foreground">
              Born {formatDate(customer.date_of_birth)}
            </p>
          )}
        </div>
        <WorkflowActions actions={actions} />
      </div>

      {canSeeCredit && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Figure
            label="Balance"
            value={formatMoney(customer.balance, currency)}
            tone={customer.owing ? "danger" : undefined}
          />
          <Figure
            label="Credit limit"
            value={
              customer.credit_allowed
                ? customer.credit_limit
                  ? formatMoney(customer.credit_limit, currency)
                  : "No limit"
                : "Cash only"
            }
          />
          <Figure label="Available" value={availableCreditLabel(customer, currency)} />
        </div>
      )}

      {customer.notes && (
        <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm">{customer.notes}</p>
      )}

      <Tabs defaultValue={canSeeCredit ? "account" : "addresses"}>
        <TabsList variant="line">
          {canSeeCredit && <TabsTrigger value="account">Account</TabsTrigger>}
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          {showFollowUps && <TabsTrigger value="follow-ups">Follow-ups</TabsTrigger>}
          {showLoyalty && <TabsTrigger value="loyalty">Loyalty</TabsTrigger>}
        </TabsList>

        {canSeeCredit && (
          <TabsContent value="account" className="pt-4">
            <AccountTab customerId={customer.id} currency={currency} />
          </TabsContent>
        )}
        <TabsContent value="addresses" className="pt-4">
          <AddressesTab customerId={customer.id} canEdit={canEdit} />
        </TabsContent>
        <TabsContent value="notes" className="pt-4">
          <NotesTab customerId={customer.id} canEdit={canEdit} />
        </TabsContent>
        {showFollowUps && (
          <TabsContent value="follow-ups" className="pt-4">
            <FollowUpsList customerId={customer.id} />
          </TabsContent>
        )}
        {showLoyalty && (
          <TabsContent value="loyalty" className="pt-4">
            <LoyaltyTab customerId={customer.id} />
          </TabsContent>
        )}
      </Tabs>

      <CustomerDialog open={editing} onOpenChange={setEditing} customer={customer} />
      <RecordPaymentDialog
        open={paying}
        onOpenChange={setPaying}
        customer={customer}
        currency={currency}
      />
    </div>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone?: "danger" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-xl font-semibold tabular-nums ${
          tone === "danger" ? "text-destructive" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
