"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { visibleWorkflowActions, type WorkflowAction } from "./actions";

export type { WorkflowAction } from "./actions";

/**
 * The status-driven action bar that sits beside `PageHeader` on any record
 * with a lifecycle — transfers, counts, purchase orders — and is reused
 * again by the vertical modules in a later phase.
 *
 * Two rules it exists to enforce in one place:
 *
 *   * An action is offered only when the record's status allows it *and*
 *     the caller holds its permission (see `visibleWorkflowActions`). These
 *     workflows deliberately split "request" from "approve" so one person
 *     cannot move stock alone, and a bar that showed both to everyone would
 *     undo that separation visually even though the backend still refused.
 *   * A destructive or irreversible transition routes through
 *     `ConfirmDialog` rather than firing on a single click — posting a
 *     receipt or approving a variance writes the stock ledger.
 */
export function WorkflowActions({
  actions,
  className,
}: {
  actions: WorkflowAction[];
  className?: string;
}) {
  const [confirming, setConfirming] = useState<WorkflowAction | null>(null);
  const visible = visibleWorkflowActions(actions);

  if (visible.length === 0) return null;

  return (
    <>
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        {visible.map((action) => (
          <Button
            key={action.key}
            variant={action.variant ?? "outline"}
            disabled={action.pending}
            onClick={() => (action.confirm ? setConfirming(action) : void action.onAction())}
          >
            {action.pending && <Loader2 className="size-4 animate-spin" />}
            {action.label}
          </Button>
        ))}
      </div>

      {confirming?.confirm && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          title={confirming.confirm.title}
          description={confirming.confirm.description}
          confirmLabel={confirming.confirm.confirmLabel ?? confirming.label}
          destructive={confirming.confirm.destructive}
          loading={confirming.pending}
          onConfirm={async () => {
            await confirming.onAction();
            setConfirming(null);
          }}
        />
      )}
    </>
  );
}
