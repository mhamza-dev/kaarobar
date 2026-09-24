"use client";

import { Form, Formik } from "formik";
import { Loader2, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormTextField } from "@/components/forms/FormTextField";
import { EmptyState } from "@/components/shared/EmptyState";
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
import { useFloorPlan, useSeatTable } from "@/hooks/queries/useDining";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import type { DiningTable, FloorPlanEntry } from "@/types/api/dining";

/**
 * The host stand: every table, grouped by floor, and who is sitting where.
 *
 * A free table opens the seat dialog; an occupied one opens its sitting.
 * "Seated for" comes from the server (`minutes_seated`) rather than being
 * counted here from `opened_at`, so every tablet in the room agrees.
 */
export function FloorPlan() {
  const router = useRouter();
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: entries, isLoading, error, refetch } = useFloorPlan();
  const [seating, setSeating] = useState<DiningTable | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Couldn't load the floor"
        description={error.message}
        action={<Button onClick={() => refetch()}>Try again</Button>}
      />
    );
  }

  const active = (entries ?? []).filter((entry) => entry.table.is_active);

  if (active.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No tables yet"
        description="Set up your floors and tables to start seating guests."
        action={
          can("table:manage") && (
            <Button nativeButton={false} render={<Link href="/dining/tables" />}>
              Set up tables
            </Button>
          )
        }
      />
    );
  }

  const floors = groupByFloor(active);
  const occupiedCount = active.filter((entry) => entry.occupied).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {occupiedCount} of {active.length} tables occupied
        </p>
        {can("table:manage") && (
          <Button variant="outline" nativeButton={false} render={<Link href="/dining/tables" />}>
            <Settings2 className="size-4" />
            Tables
          </Button>
        )}
      </div>

      {floors.map(([floorName, floorEntries]) => (
        <section key={floorName} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-muted-foreground">{floorName}</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {floorEntries.map((entry) => (
              <TableTile
                key={entry.table.id}
                entry={entry}
                currency={currency}
                onClick={() => {
                  if (entry.session) router.push(`/dining/sessions/${entry.session.id}`);
                  else if (can("order:create")) setSeating(entry.table);
                }}
              />
            ))}
          </div>
        </section>
      ))}

      <SeatDialog
        table={seating}
        onOpenChange={() => setSeating(null)}
        onSeated={(sessionId) => router.push(`/dining/sessions/${sessionId}`)}
      />
    </div>
  );
}

function groupByFloor(entries: FloorPlanEntry[]): Array<[string, FloorPlanEntry[]]> {
  const groups = new Map<string, FloorPlanEntry[]>();
  for (const entry of entries) {
    const name = entry.table.floor?.name ?? "Tables";
    groups.set(name, [...(groups.get(name) ?? []), entry]);
  }
  return [...groups.entries()];
}

function TableTile({
  entry,
  currency,
  onClick,
}: {
  entry: FloorPlanEntry;
  currency: string;
  onClick: () => void;
}) {
  const { table, session, occupied, minutes_seated } = entry;
  const billed = session?.status === "billed";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-28 flex-col justify-between rounded-xl border p-3 text-left transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        occupied
          ? billed
            ? "border-warning bg-warning-soft"
            : "border-brand-primary bg-brand-tint"
          : "border-border bg-card hover:bg-muted",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-lg font-semibold">{table.name}</span>
        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            occupied ? "text-foreground/75" : "text-muted-foreground",
          )}
        >
          <Users className="size-3" />
          {occupied ? `${session?.covers ?? "?"}/${table.seats ?? "?"}` : (table.seats ?? "—")}
        </span>
      </div>
      {occupied ? (
        <div className="text-xs">
          <p className="font-medium">{billed ? "Bill printed" : (session?.label ?? "Seated")}</p>
          <p className="text-foreground/75">
            {minutes_seated ?? 0} min
            {session?.order?.total && ` · ${formatMoney(session.order.total, currency)}`}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Free</p>
      )}
    </button>
  );
}

function SeatDialog({
  table,
  onOpenChange,
  onSeated,
}: {
  table: DiningTable | null;
  onOpenChange: (open: boolean) => void;
  onSeated: (sessionId: string) => void;
}) {
  const seat = useSeatTable();

  return (
    <Dialog open={!!table} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Seat {table?.name}</DialogTitle>
          <DialogDescription>Opens the table&apos;s bill.</DialogDescription>
        </DialogHeader>
        <Formik
          initialValues={{ covers: String(Math.min(2, table?.seats ?? 2)), label: "" }}
          enableReinitialize
          validationSchema={Yup.object({
            covers: Yup.number()
              .transform((value, original) => (original === "" ? undefined : value))
              .required("How many guests?")
              .integer()
              .min(1, "At least one guest"),
          })}
          onSubmit={async (values, helpers) => {
            if (!table) return;
            try {
              const session = await seat.mutateAsync([
                {
                  table_id: table.id,
                  covers: Number(values.covers),
                  label: values.label || undefined,
                },
              ]);
              onSeated(session.id);
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
              <FormNumberField name="covers" label="Guests" min={1} step={1} autoFocus />
              <FormTextField name="label" label="Name" placeholder="Party name (optional)" />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Seat
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
