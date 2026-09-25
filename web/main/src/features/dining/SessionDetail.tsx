"use client";

import { ChefHat, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddOrderItems,
  useCloseSession,
  useFireOrder,
  useFloorPlan,
  useMarkSessionBilled,
  useOrder,
  useRemoveOrderItem,
  useStations,
  useTableSession,
  useMergeSession,
  useTransferSession,
} from "@/hooks/queries/useDining";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatMoney, formatQuantity } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";

import { ProductSearch } from "../pos/ProductSearch";

/**
 * One sitting: the table's running order and what can happen next.
 *
 * Items are added to the order as they are asked for and priced by the
 * backend on the way in, so the running total is always the server's.
 * "Send to kitchen" fires whatever hasn't been fired yet, split per station.
 * Payment is taken at the till (`/pos?order=…`) — that is where the drawer
 * and the shift are — and the table is cleared once nothing is unpaid.
 */
export function SessionDetail({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { can } = usePermission();
  const business = useSessionStore((state) => state.scope?.business);
  const currency = business?.currency ?? "PKR";
  const hasKitchen = business?.modules.includes("kitchen") ?? false;

  const { data: session, isLoading, isError } = useTableSession(sessionId);
  const { data: order } = useOrder(session?.order_id);
  // Firing with no stations is refused (`no_kitchen_stations`); say so up
  // front rather than offering a button that can only fail.
  const { data: stations } = useStations();
  const hasStations = (stations ?? []).some((station) => station.is_active);
  const addItems = useAddOrderItems();
  const removeItem = useRemoveOrderItem();
  const fire = useFireOrder();
  const bill = useMarkSessionBilled();
  const close = useCloseSession();
  const [moving, setMoving] = useState(false);
  const [merging, setMerging] = useState(false);

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (isError || !session) {
    return <p className="text-sm text-muted-foreground">We couldn&apos;t load this table.</p>;
  }

  const live = session.status === "open" || session.status === "billed";
  const items = order?.items ?? [];
  const unpaid = items.some((item) => Number(item.unbilled_quantity) > 0);
  const canEditOrder = live && can("order:edit");

  const actions: WorkflowAction[] = [
    {
      key: "fire",
      label: "Send to kitchen",
      variant: "default",
      available: live && hasKitchen && hasStations && items.length > 0,
      permitted: can("kitchen:bump"),
      pending: fire.isPending,
      onAction: async () => {
        try {
          await fire.mutateAsync([{ order_id: session.order_id! }]);
          toast.success("Sent to the kitchen");
        } catch {
          // Toasted by the hook.
        }
      },
    },
    {
      key: "bill",
      label: "Print bill",
      available: session.status === "open" && items.length > 0,
      permitted: can("order:edit"),
      pending: bill.isPending,
      onAction: async () => {
        try {
          await bill.mutateAsync([session.id]);
          toast.success("Marked as billed");
        } catch {
          // Toasted by the hook.
        }
      },
    },
    {
      key: "pay",
      label: "Take payment",
      variant: "default",
      available: live && unpaid,
      permitted: can("sales:checkout"),
      onAction: () => router.push(`/pos?order=${session.order_id}`),
    },
    {
      key: "move",
      label: "Move table",
      available: live,
      permitted: can("order:create"),
      onAction: () => setMoving(true),
    },
    {
      key: "merge",
      label: "Join another table",
      available: live,
      permitted: can("order:create"),
      onAction: () => setMerging(true),
    },
    {
      key: "close",
      label: "Clear table",
      available: live && !unpaid,
      permitted: can("order:edit"),
      pending: close.isPending,
      confirm: {
        title: `Clear ${session.dining_table?.name ?? "this table"}?`,
        description: "The bill is settled. The table goes back to free on the floor plan.",
        confirmLabel: "Clear table",
      },
      onAction: async () => {
        try {
          await close.mutateAsync([session.id]);
          toast.success("Table cleared");
          router.push("/dining");
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
            <h2 className="text-xl font-semibold">{session.dining_table?.name ?? "Table"}</h2>
            <StatusBadge status={session.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {session.covers ?? "?"} guests
            {session.label && ` · ${session.label}`}
            {order?.number && ` · ${order.number}`}
          </p>
        </div>
        <WorkflowActions actions={actions} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-3">
          {canEditOrder && session.order_id && (
            <ProductSearch
              onPick={async (product) => {
                try {
                  await addItems.mutateAsync([
                    session.order_id!,
                    [{ variant_id: product.variantId, quantity: "1" }],
                  ]);
                } catch {
                  // Toasted by the hook.
                }
              }}
            />
          )}

          <div className="rounded-xl border border-border bg-card">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Nothing ordered yet — search above to add dishes.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => {
                  const paid = Number(item.unbilled_quantity) === 0;
                  return (
                    <li key={item.id} className="flex items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {formatQuantity(item.quantity)} × {item.name}
                        </p>
                        {item.note && <p className="text-xs text-muted-foreground">{item.note}</p>}
                        {paid && <p className="text-xs text-success">Paid</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm tabular-nums">
                          {formatMoney(item.line_total, currency)}
                        </span>
                        {canEditOrder && !paid && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove ${item.name}`}
                            disabled={removeItem.isPending}
                            onClick={async () => {
                              try {
                                await removeItem.mutateAsync([session.order_id!, item.id]);
                              } catch {
                                // Toasted by the hook.
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div className="flex h-fit flex-col gap-1 rounded-xl border border-border bg-card p-4 text-sm">
          <Row label="Subtotal" value={formatMoney(order?.subtotal, currency)} />
          {order?.discount_total && Number(order.discount_total) > 0 && (
            <Row label="Discounts" value={`-${formatMoney(order.discount_total, currency)}`} />
          )}
          <Row label="Tax" value={formatMoney(order?.tax_total, currency)} />
          <div className="mt-2 flex items-baseline justify-between border-t border-border pt-2">
            <span className="font-medium">Total</span>
            <span className="text-lg font-semibold tabular-nums">
              {formatMoney(order?.total, currency)}
            </span>
          </div>
          {hasKitchen && stations && !hasStations && (
            <p className="mt-2 flex items-center gap-1 text-xs text-warning">
              <ChefHat className="size-3" />
              <span>
                No kitchen stations yet —{" "}
                <Link href="/kitchen/stations" className="underline">
                  add one
                </Link>{" "}
                to send orders to the kitchen.
              </span>
            </p>
          )}
          {hasKitchen && hasStations && (
            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
              <ChefHat className="size-3" />
              New items reach the kitchen when you send them.
            </p>
          )}
        </div>
      </div>

      <MoveTableDialog
        open={moving}
        onOpenChange={setMoving}
        sessionId={session.id}
        currentTableId={session.dining_table_id}
      />
      <MergeTablesDialog
        open={merging}
        onOpenChange={setMerging}
        sessionId={session.id}
        tableName={session.dining_table?.name ?? "this table"}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/** Moving a party keeps their bill — only free tables are offered. */
/**
 * Two tables pushed together become one bill: this table's order moves
 * onto the other party's session, and this sitting closes into it.
 */
function MergeTablesDialog({
  open,
  onOpenChange,
  sessionId,
  tableName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  tableName: string;
}) {
  const router = useRouter();
  const { data: entries } = useFloorPlan();
  const merge = useMergeSession();
  const others = (entries ?? []).filter(
    (entry) => entry.occupied && entry.session && entry.session.id !== sessionId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join {tableName} to another table</DialogTitle>
          <DialogDescription>
            One bill for both: what {tableName} has ordered moves onto the table you pick.
          </DialogDescription>
        </DialogHeader>
        {others.length === 0 ? (
          <p className="text-sm text-muted-foreground">No other table is seated right now.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {others.map((entry) => (
              <Button
                key={entry.table.id}
                variant="outline"
                disabled={merge.isPending}
                onClick={async () => {
                  try {
                    await merge.mutateAsync([sessionId, entry.session!.id]);
                    toast.success(`Joined to ${entry.table.name}`);
                    onOpenChange(false);
                    router.replace(`/dining/sessions/${entry.session!.id}`);
                  } catch {
                    // Toasted by the hook.
                  }
                }}
              >
                {entry.table.name}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MoveTableDialog({
  open,
  onOpenChange,
  sessionId,
  currentTableId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sessionId: string;
  currentTableId: string;
}) {
  const { data: entries } = useFloorPlan();
  const transfer = useTransferSession();
  const free = (entries ?? []).filter(
    (entry) => !entry.occupied && entry.table.is_active && entry.table.id !== currentTableId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to another table</DialogTitle>
          <DialogDescription>The bill moves with the party.</DialogDescription>
        </DialogHeader>
        {free.length === 0 ? (
          <p className="text-sm text-muted-foreground">No free tables right now.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {free.map((entry) => (
              <Button
                key={entry.table.id}
                variant="outline"
                disabled={transfer.isPending}
                onClick={async () => {
                  try {
                    await transfer.mutateAsync([sessionId, entry.table.id]);
                    toast.success(`Moved to ${entry.table.name}`);
                    onOpenChange(false);
                  } catch {
                    // Toasted by the hook.
                  }
                }}
              >
                {entry.table.name}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
