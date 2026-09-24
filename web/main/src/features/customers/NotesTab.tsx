"use client";

import { Pin, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useAddCustomerNote,
  useCustomerNotes,
  useDeleteCustomerNote,
} from "@/hooks/queries/useCustomers";
import { toast } from "@/hooks/useToast";
import { formatDateTime } from "@/lib/format";

/**
 * Free-text notes, pinned first.
 *
 * A plain composer rather than a Formik form: one field, no validation
 * beyond "not blank", and it clears on success — the form machinery would
 * be all ceremony here.
 */
export function NotesTab({ customerId, canEdit }: { customerId: string; canEdit: boolean }) {
  const { data: notes, isLoading } = useCustomerNotes(customerId);
  const addNote = useAddCustomerNote();
  const deleteNote = useDeleteCustomerNote();

  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);

  const sorted = [...(notes ?? [])].sort(
    (a, b) =>
      Number(b.is_pinned) - Number(a.is_pinned) || b.inserted_at.localeCompare(a.inserted_at),
  );

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <form
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!body.trim()) return;
            try {
              await addNote.mutateAsync([customerId, { body: body.trim(), is_pinned: pinned }]);
              setBody("");
              setPinned(false);
            } catch {
              // Toasted by the hook.
            }
          }}
        >
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Add a note about this customer…"
            rows={2}
            aria-label="New note"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="note-pinned"
                checked={pinned}
                onCheckedChange={(checked) => setPinned(checked === true)}
              />
              <Label htmlFor="note-pinned" className="text-sm font-normal">
                Pin to top
              </Label>
            </div>
            <Button type="submit" size="sm" disabled={!body.trim() || addNote.isPending}>
              Add note
            </Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <Skeleton className="h-16 w-full" />
      ) : sorted.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((note) => (
            <li
              key={note.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="text-sm whitespace-pre-wrap">{note.body}</p>
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  {note.is_pinned && <Pin className="size-3" aria-label="Pinned" />}
                  {note.author_label ?? "Someone"} · {formatDateTime(note.inserted_at)}
                </p>
              </div>
              {canEdit && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete note"
                  disabled={deleteNote.isPending}
                  onClick={async () => {
                    try {
                      await deleteNote.mutateAsync([note.id]);
                      toast.success("Note deleted");
                    } catch {
                      // Toasted by the hook.
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
