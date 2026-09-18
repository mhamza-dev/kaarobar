"use client";

import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button — for deletes and anything else not undoable. */
  destructive?: boolean;
  /** Disables both buttons and spins the confirm while the mutation is in flight. */
  loading?: boolean;
  onConfirm: () => void;
};

/**
 * The one confirmation prompt in the app — built on `alert-dialog` rather
 * than `dialog` so it takes focus and cannot be dismissed by a stray click
 * outside, which is the whole point for a destructive action.
 *
 * Controlled (`open`/`onOpenChange`) rather than trigger-wrapping, because
 * the common case is confirming a row action from inside a `DataTable`
 * where the trigger and the dialog live in different subtrees. The caller
 * owns the mutation and closes on success; `loading` keeps the dialog up
 * and non-dismissable while the request is in flight so a double-click
 * cannot fire it twice.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  loading,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next: boolean) => !loading && onOpenChange(next)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel render={<Button variant="outline" disabled={loading} />}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            render={
              <Button
                variant={destructive ? "destructive" : "default"}
                disabled={loading}
                onClick={(event) => {
                  // The action closes the dialog by default; the caller
                  // decides when it closes, after the mutation settles.
                  event.preventDefault();
                  onConfirm();
                }}
              />
            }
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
