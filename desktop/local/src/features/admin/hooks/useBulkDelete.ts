import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '../../../components/ui'

type Pending = {
  ids: string[]
  /** Empties the table's selection. A no-op for a single-row delete. */
  clear: () => void
}

export type BulkDelete = {
  /** True while the confirm dialog should be open. */
  open: boolean
  /** How many records the pending delete covers, for the dialog title. */
  count: number
  /** True while the deletes are running; keeps the dialog open and disabled. */
  busy: boolean
  /** Queue one row, from a row-actions menu. */
  askOne: (id: string) => void
  /** Queue a table selection, from `Table`'s `bulkActions`. */
  askMany: (ids: string[], clear: () => void) => void
  cancel: () => void
  confirm: () => void
}

/**
 * The confirm-then-delete-then-refresh dance, once instead of four times.
 *
 * Deleting a sale, a customer, a supplier and a purchase order all need the
 * same thing around them: a confirmation the user has to read, one request per
 * record, a refresh afterwards, and an honest account of which ones failed.
 *
 * ## Why it does not stop at the first failure
 *
 * Bulk deletes fail in the middle for ordinary reasons — a purchase order with
 * stock received against it, a record someone else already removed. Aborting
 * there leaves the user with a half-finished job and no idea where it stopped.
 * Every id is attempted, and the ones that refused are named back to the user
 * so they can see exactly what is still there.
 *
 * @param remove   Deletes one record by id. Throwing marks that id as failed.
 * @param label    Turns a failed id into something a person recognises — an
 *                 invoice number, a customer's name — for the error toast.
 * @param refresh  Reloads the list once the run is over.
 * @param messages Toast/dialog keys, so each page names its own records.
 */
export function useBulkDelete(options: {
  remove: (id: string) => Promise<unknown>
  label: (id: string) => string
  refresh: () => Promise<unknown>
  messages: { success: string; failure: string }
}): BulkDelete {
  const { t } = useTranslation()
  const toast = useToast()
  // Ids rather than rows: the list is refetched after a delete, so anything
  // holding row objects would point at rows that no longer exist by the time
  // the dialog closes.
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(target: Pending) {
    setBusy(true)
    const failures: string[] = []
    for (const id of target.ids) {
      try {
        await options.remove(id)
      } catch (_e) {
        failures.push(options.label(id))
      }
    }
    setBusy(false)
    setPending(null)
    target.clear()
    await options.refresh()

    const deleted = target.ids.length - failures.length
    if (deleted > 0) toast.success(t(options.messages.success, { count: deleted }))
    if (failures.length > 0) {
      toast.error(t(options.messages.failure, { names: failures.join(', ') }))
    }
  }

  return {
    open: pending !== null,
    count: pending?.ids.length ?? 0,
    busy,
    askOne: (id) => setPending({ ids: [id], clear: () => undefined }),
    askMany: (ids, clear) => setPending({ ids, clear }),
    // Cancelling mid-run would leave half the records deleted and the dialog
    // lying about it, so the close is ignored while the run is in flight.
    cancel: () => {
      if (!busy) setPending(null)
    },
    confirm: () => {
      if (pending && !busy) void run(pending)
    },
  }
}
