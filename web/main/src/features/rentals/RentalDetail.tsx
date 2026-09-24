"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

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
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCancelRental,
  useIssueRental,
  useRental,
  useReturnRental,
} from "@/hooks/queries/useRentals";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { RETURN_CONDITIONS, type RentalAgreement } from "@/types/api/rentals";

/**
 * One hire: what went out, when it's due, and what it owes. Late fees are
 * computed by the backend from the agreed return date and the rates — the
 * return dialog only adds damage and records each unit's condition.
 */
export function RentalDetail({ rentalId }: { rentalId: string }) {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: hire, isLoading, isError } = useRental(rentalId);
  const issue = useIssueRental();
  const cancel = useCancelRental();
  const [returning, setReturning] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !hire) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load this hire.</p>;
  }

  const canManage = can("rental:manage");
  const out = hire.status === "on_hire" || hire.status === "overdue";

  const actions: WorkflowAction[] = [
    {
      key: "issue",
      label: "Hand over",
      variant: "default",
      available: hire.status === "reserved",
      permitted: canManage,
      pending: issue.isPending,
      onAction: async () => {
        try {
          await issue.mutateAsync([hire.id]);
          toast.success("Handed over");
        } catch {
          // Toasted by the hook.
        }
      },
    },
    {
      key: "return",
      label: "Take back",
      variant: "default",
      available: out,
      permitted: canManage,
      onAction: () => setReturning(true),
    },
    {
      key: "cancel",
      label: "Cancel hire",
      available: hire.status === "reserved",
      permitted: canManage,
      onAction: () => setCancelling(true),
    },
  ];

  const figures: Array<[string, string | null]> = [
    ["Hire", hire.hire_total],
    ["Deposit held", hire.deposit_held],
    ["Late fee", hire.late_fee],
    ["Damage", hire.damage_fee],
    ["Total due", hire.total_due],
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">{hire.number}</h2>
            <StatusBadge status={hire.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {hire.customer?.name ?? "—"} · {formatDateTime(hire.starts_at)} →{" "}
            {formatDateTime(hire.due_back_at)}
            {hire.days_late ? ` · ${hire.days_late} days late` : ""}
          </p>
        </div>
        <WorkflowActions actions={actions} />
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {figures.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(value, currency)}</dd>
          </div>
        ))}
      </dl>

      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {(hire.lines ?? []).map((line) => (
          <li
            key={line.id}
            className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"
          >
            <div>
              <p className="font-medium">
                {line.name ?? line.rental_unit?.asset_code}
                {line.rental_unit && ` · ${line.rental_unit.asset_code}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(line.daily_rate, currency)}/day · deposit{" "}
                {formatMoney(line.deposit_amount, currency)}
              </p>
            </div>
            {line.returned_at ? (
              <StatusBadge
                status={line.return_condition ?? "returned"}
                tone={line.return_condition === "good" ? "success" : undefined}
              />
            ) : line.out ? (
              <StatusBadge status="on_hire" tone="info" />
            ) : null}
          </li>
        ))}
      </ul>

      <ReasonDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${hire.number}?`}
        description="The units are released for other bookings."
        confirmLabel="Cancel hire"
        destructive
        onSubmit={async (reason) => {
          await cancel.mutateAsync([hire.id, reason]);
          toast.success("Hire cancelled");
        }}
      />

      {returning && (
        <ReturnDialog hire={hire} currency={currency} onOpenChange={() => setReturning(false)} />
      )}
    </div>
  );
}

function ReturnDialog({
  hire,
  currency,
  onOpenChange,
}: {
  hire: RentalAgreement;
  currency: string;
  onOpenChange: (open: boolean) => void;
}) {
  const takeBack = useReturnRental();
  const outLines = (hire.lines ?? []).filter((line) => line.out);
  const [conditions, setConditions] = useState<Record<string, string>>(
    Object.fromEntries(outLines.map((line) => [line.id, "good"])),
  );
  const [damageFee, setDamageFee] = useState("");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Take back {hire.number}</DialogTitle>
          <DialogDescription>
            Any late fee is worked out from the due date. Fees come out of the{" "}
            {formatMoney(hire.deposit_held, currency)} deposit first.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {outLines.map((line) => (
            <div key={line.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{line.rental_unit?.asset_code ?? line.name}</span>
              <select
                value={conditions[line.id]}
                onChange={(event) =>
                  setConditions((current) => ({ ...current, [line.id]: event.target.value }))
                }
                aria-label={`Condition of ${line.rental_unit?.asset_code ?? line.name}`}
                className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
              >
                {RETURN_CONDITIONS.map((condition) => (
                  <option key={condition} value={condition}>
                    {humanize(condition)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="damage-fee">Damage charge</Label>
            <Input
              id="damage-fee"
              type="number"
              min={0}
              step="0.01"
              value={damageFee}
              onChange={(event) => setDamageFee(event.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={takeBack.isPending}
            onClick={async () => {
              try {
                await takeBack.mutateAsync([
                  hire.id,
                  { conditions, damage_fee: damageFee || undefined },
                ]);
                toast.success("Taken back");
                onOpenChange(false);
              } catch {
                // Toasted by the hook.
              }
            }}
          >
            {takeBack.isPending && <Loader2 className="size-4 animate-spin" />}
            Take back
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
