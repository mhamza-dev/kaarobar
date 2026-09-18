import type { ReactNode } from "react";

export type WorkflowAction = {
  key: string;
  label: string;
  /**
   * Whether the record's current status allows this transition. Prefer a
   * server-computed boolean (`order.receivable`, `order.editable`) over
   * re-deriving the status machine on the client, so the two cannot drift.
   */
  available: boolean;
  /** Whether the caller holds the permission this transition needs. */
  permitted: boolean;
  onAction: () => void | Promise<void>;
  variant?: "default" | "outline" | "destructive";
  /** When set, the action goes through ConfirmDialog first. */
  confirm?: {
    title: string;
    description?: ReactNode;
    confirmLabel?: string;
    destructive?: boolean;
  };
  pending?: boolean;
};

/**
 * Which actions a workflow bar actually renders.
 *
 * Hides anything the caller lacks permission for, matching how the rest of
 * the app treats permissions — an action nobody can take is not a disabled
 * button to explain, it is an action that is not offered. Status-unavailable
 * actions are hidden too: "Dispatch" on an already-received transfer is not
 * a thing the user should see at all.
 *
 * Extracted so the rules can be tested without mounting a dialog.
 */
export function visibleWorkflowActions(actions: WorkflowAction[]): WorkflowAction[] {
  return actions.filter((action) => action.available && action.permitted);
}

/** True when the workflow offers nothing — the bar renders nothing at all. */
export function isWorkflowIdle(actions: WorkflowAction[]): boolean {
  return visibleWorkflowActions(actions).length === 0;
}
