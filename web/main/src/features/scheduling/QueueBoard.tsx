"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCallFromQueue,
  useJoinQueue,
  useLeaveQueue,
  useQueue,
} from "@/hooks/queries/useScheduling";
import { usePermission } from "@/hooks/usePermission";

/**
 * The walk-in queue: who's waiting, for how long (the server's count), and
 * the one-tap actions at the counter — call them up, or mark them gone.
 */
export function QueueBoard() {
  const { can } = usePermission();
  const canManage = can("queue:manage");
  const { data: entries, isLoading } = useQueue();
  const join = useJoinQueue();
  const call = useCallFromQueue();
  const leave = useLeaveQueue();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!name.trim()) return;
            try {
              await join.mutateAsync([{ name: name.trim(), phone: phone || undefined }]);
              setName("");
              setPhone("");
            } catch {
              // Toasted by the hook.
            }
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Name"
            aria-label="Walk-in name"
            className="w-48"
          />
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="Phone (optional)"
            aria-label="Walk-in phone"
            type="tel"
            className="w-44"
          />
          <Button type="submit" disabled={!name.trim() || join.isPending}>
            <UserPlus className="size-4" />
            Add to queue
          </Button>
        </form>
      )}

      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : (entries ?? []).length === 0 ? (
        <EmptyState title="Nobody waiting" description="Walk-ins you add appear here in order." />
      ) : (
        <ol className="flex flex-col gap-2">
          {(entries ?? []).map((entry, index) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                  {index + 1}
                </span>
                <div>
                  <p className="font-medium">{entry.name ?? "Walk-in"}</p>
                  <p className="text-xs text-muted-foreground">
                    Waiting {entry.minutes_waiting ?? 0} min
                    {entry.requested_resource && ` · for ${entry.requested_resource.name}`}
                    {entry.phone && ` · ${entry.phone}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={entry.status} />
                {canManage && entry.status === "waiting" && (
                  <Button size="sm" onClick={() => call.mutate([entry.id])}>
                    Call
                  </Button>
                )}
                {canManage && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => leave.mutate([entry.id, "left"])}
                    >
                      Left
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => leave.mutate([entry.id, "no_show"])}
                    >
                      No-show
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
