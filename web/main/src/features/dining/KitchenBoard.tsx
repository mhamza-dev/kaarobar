"use client";

import { ChefHat, Flame, Wifi, WifiOff } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useAdvanceTicket, useKitchenBoard, useStations } from "@/hooks/queries/useDining";
import { useTenantKey } from "@/hooks/queries/keys";
import { useChannelRefresh } from "@/hooks/useChannelRefresh";
import { usePermission } from "@/hooks/usePermission";
import { nextTicketAction, sortBoard } from "@/lib/kitchen";
import { cn } from "@/lib/utils";
import { useSessionStore } from "@/stores/sessionStore";
import type { BoardEntry } from "@/types/api/dining";

/**
 * The kitchen display.
 *
 * Live over the `kds:<branch>` channel: the backend broadcasts
 * `board_changed` whenever a ticket is fired, started, bumped or recalled,
 * and this screen re-reads `GET /kitchen/board` in response. The clocks on
 * each card (`elapsed_minutes`, `minutes_late`) are the server's, so every
 * screen in the kitchen shows the same wait.
 */
export function KitchenBoard() {
  const { can } = usePermission();
  const tenant = useTenantKey();
  const scopeBranchId = useSessionStore((state) => state.scope?.branch?.id);
  const { data: branches } = useBranchesList();
  const [stationId, setStationId] = useState("");

  // An owner's session has no single branch; the kitchen is the main one's.
  const branchId =
    scopeBranchId ?? branches?.find((branch) => branch.is_main)?.id ?? branches?.[0]?.id ?? null;

  const { data: stations } = useStations();
  const { data: entries, isLoading, error } = useKitchenBoard(stationId || undefined);
  const advance = useAdvanceTicket();
  const live = useChannelRefresh(branchId ? `kds:${branchId}` : null, "board_changed", [
    "kitchen-board",
    tenant,
  ]);

  const canBump = can("kitchen:bump");
  const sorted = sortBoard(entries ?? []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant={stationId === "" ? "default" : "outline"}
            onClick={() => setStationId("")}
          >
            All stations
          </Button>
          {(stations ?? [])
            .filter((station) => station.is_active)
            .map((station) => (
              <Button
                key={station.id}
                size="sm"
                variant={stationId === station.id ? "default" : "outline"}
                onClick={() => setStationId(station.id)}
              >
                {station.name}
              </Button>
            ))}
        </div>
        <span
          className={cn(
            "flex items-center gap-1 text-xs",
            live ? "text-success" : "text-muted-foreground",
          )}
        >
          {live ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {live ? "Live" : "Refreshing every 30s"}
        </span>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-48" />
          ))}
        </div>
      ) : error ? (
        <EmptyState title="Couldn't load the board" description={error.message} />
      ) : sorted.length === 0 ? (
        <EmptyState icon={ChefHat} title="All clear" description="No tickets waiting." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sorted.map((entry) => (
            <TicketCard
              key={entry.ticket.id}
              entry={entry}
              canBump={canBump}
              pending={advance.isPending && advance.variables?.[0] === entry.ticket.id}
              onAdvance={(action) => advance.mutate([entry.ticket.id, action])}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TicketCard({
  entry,
  canBump,
  pending,
  onAdvance,
}: {
  entry: BoardEntry;
  canBump: boolean;
  pending: boolean;
  onAdvance: (action: "start" | "ready" | "bump") => void;
}) {
  const { ticket, station, elapsed_minutes, late, minutes_late } = entry;
  const next = nextTicketAction(ticket.status);

  return (
    <article
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-3",
        late ? "border-destructive" : "border-border",
        ticket.status === "ready" && "border-success bg-success-soft",
      )}
      aria-label={`Ticket ${ticket.number ?? ""} ${ticket.table_label ?? ""}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-1 font-semibold">
            {ticket.is_priority && (
              <Flame className="size-4 text-destructive" aria-label="Priority" />
            )}
            {ticket.table_label ?? ticket.service_mode ?? "Order"}
          </p>
          <p className="text-xs text-muted-foreground">
            {ticket.number}
            {station && ` · ${station.name}`}
            {ticket.course && ticket.course > 1 && ` · course ${ticket.course}`}
          </p>
        </div>
        <div className="text-right">
          <p className={cn("text-lg font-semibold tabular-nums", late && "text-destructive")}>
            {elapsed_minutes}m
          </p>
          {late && <p className="text-xs text-destructive">{minutes_late}m late</p>}
        </div>
      </header>

      <ul className="flex flex-col gap-1 text-sm">
        {(ticket.items ?? []).map((item) => (
          <li
            key={item.id}
            className={cn(item.status === "cancelled" && "text-muted-foreground line-through")}
          >
            {item.display_line}
            {item.note && <span className="block text-xs text-warning">{item.note}</span>}
          </li>
        ))}
      </ul>
      {ticket.notes && <p className="text-xs text-warning">{ticket.notes}</p>}

      <footer className="mt-auto flex items-center justify-between gap-2">
        <StatusBadge status={ticket.status} />
        {canBump && next && (
          <Button
            size="sm"
            variant={next.action === "bump" ? "default" : "outline"}
            disabled={pending}
            onClick={() => onAdvance(next.action)}
          >
            {next.label}
          </Button>
        )}
      </footer>
    </article>
  );
}
