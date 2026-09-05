import { createHash } from 'node:crypto'
import { callSupabaseRpc, getSupabaseConfig } from '../config/supabase'
import { setCustomerSyncState } from '../config/store'
import { getDb, isDatabaseOpen } from '../db/connection'
import { getLicenseStatus } from '../licensing/service'

/**
 * Pushes the shop's customer book up to Supabase.
 *
 * One direction only. SQLite on the shop's machine is the source of truth and
 * always wins; nothing is ever read back down. This is a mirror for reporting
 * and for the day a hard disk dies — not a two-way sync, and it must never be
 * mistaken for one.
 *
 * ## Why a hash and not a timestamp
 *
 * The obvious design is a watermark over `customers.updated_at`: push every row
 * touched since the last run. It does not work here. Four of the five
 * statements that change a customer — a credit sale, a refund, two ledger
 * adjustments — write `current_balance` without touching `updated_at`. A
 * watermark would silently never ship a balance change, which is the single
 * number anyone would want this mirror for.
 *
 * So each row is hashed over the fields actually sent, and the hash of what was
 * last pushed is kept in `customer_sync_state`. A row is pending when its hash
 * differs from the stored one. That is true no matter how careless anyone is
 * with timestamps, and it converges after any local edit, restore, or crash.
 *
 * The same table gives deletes for free: a `customer_sync_state` row whose
 * customer no longer exists is a customer that was deleted locally, so the id
 * goes up as a soft delete and only then is the state row dropped.
 */

/** Kept under the RPC's 500-row cap, with room for long names in the payload. */
const BATCH_SIZE = 200

/**
 * A cap on one run, not on the data. A first sync of a large shop walks through
 * it a few thousand rows at a time and finishes on the next tick, so the first
 * run after an upgrade cannot sit on the network for ten minutes.
 */
const MAX_ROWS_PER_RUN = 2_000

type LocalCustomerRow = {
  id: string
  business_id: string
  business_name: string | null
  name: string
  phone: string | null
  address: string | null
  opening_balance: number
  current_balance: number
  is_active: number
  created_at: string
  updated_at: string
}

type SyncStateRow = { customer_id: string; business_id: string; hash: string }

type CustomerPayload = {
  local_id: string
  business_id: string
  business_name: string | null
  name: string
  phone: string | null
  address: string | null
  opening_balance: number
  current_balance: number
  is_active: boolean
  created_at: string
  updated_at: string
}

type DeletePayload = { local_id: string; business_id: string }

type SyncRpcResult = {
  ok: boolean
  error?: string
  written?: number
  removed?: number
}

export type CustomerSyncOutcome =
  | { state: 'synced'; pushed: number; deleted: number; pending: number }
  | { state: 'skipped'; message: string }
  | { state: 'failed'; message: string }

function toPayload(row: LocalCustomerRow): CustomerPayload {
  return {
    local_id: row.id,
    business_id: row.business_id,
    business_name: row.business_name,
    name: row.name,
    phone: row.phone,
    address: row.address,
    // Rounded to the paisa the till actually deals in, so floating-point noise
    // in the last decimal cannot make an unchanged row look pending forever.
    opening_balance: Math.round((row.opening_balance ?? 0) * 100) / 100,
    current_balance: Math.round((row.current_balance ?? 0) * 100) / 100,
    is_active: row.is_active !== 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Hash of exactly what gets sent — no more, no less.
 *
 * Hashing the payload rather than the database row is what keeps the two in
 * step: add a column to the payload and every row correctly becomes pending on
 * the next run, with no migration and nobody having to remember.
 */
function payloadHash(payload: CustomerPayload): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32)
}

export async function syncCustomersNow(): Promise<CustomerSyncOutcome> {
  if (!getSupabaseConfig()) {
    return { state: 'skipped', message: 'Supabase is not configured on this build.' }
  }
  if (!isDatabaseOpen()) {
    // Before setup, or before the first login opens the database.
    return { state: 'skipped', message: 'Database is not open.' }
  }

  const license = getLicenseStatus()
  if (license.status !== 'valid') {
    // Not a failure worth recording: an unlicensed till has nothing to say and
    // the server would refuse it anyway.
    return { state: 'skipped', message: `License is ${license.status}.` }
  }
  if (license.record.mode === 'dev') {
    return { state: 'skipped', message: 'Development license.' }
  }

  try {
    const { upserts, deletes, pending } = collectPending()
    if (!upserts.length && !deletes.length) {
      setCustomerSyncState({ syncedAt: new Date().toISOString(), error: null })
      return { state: 'synced', pushed: 0, deleted: 0, pending: 0 }
    }

    const { licenseKey, fingerprint } = license.record
    let pushed = 0
    let deleted = 0

    // Deletes first. If the run is cut short halfway, a customer removed at the
    // counter is already gone from the mirror rather than lingering as a live
    // row somebody might act on.
    for (const batch of chunk(deletes, BATCH_SIZE)) {
      await pushBatch(licenseKey, fingerprint, [], batch)
      clearDeletedState(batch)
      deleted += batch.length
    }

    for (const batch of chunk(upserts, BATCH_SIZE)) {
      await pushBatch(licenseKey, fingerprint, batch.map((entry) => entry.payload), [])
      markSynced(batch)
      pushed += batch.length
    }

    setCustomerSyncState({ syncedAt: new Date().toISOString(), error: null })
    return { state: 'synced', pushed, deleted, pending: Math.max(0, pending - pushed - deleted) }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setCustomerSyncState({ error: message })
    console.error('[customer-sync] failed:', message)
    return { state: 'failed', message }
  }
}

type PendingUpsert = { payload: CustomerPayload; hash: string }

/**
 * Everything the mirror is currently missing, capped at one run's worth.
 *
 * Reads the whole customer table each run. That is deliberate — it is a few
 * thousand short rows out of a local SQLite file, cheaper than the bookkeeping
 * needed to avoid it, and it means a row that failed to push for any reason
 * simply comes back around on the next tick.
 */
function collectPending(): {
  upserts: PendingUpsert[]
  deletes: DeletePayload[]
  pending: number
} {
  const db = getDb()

  const rows = db
    .prepare(
      `SELECT c.id, c.business_id, b.name AS business_name, c.name, c.phone, c.address,
              c.opening_balance, c.current_balance, c.is_active, c.created_at, c.updated_at
       FROM customers c
       LEFT JOIN businesses b ON b.id = c.business_id
       ORDER BY c.updated_at ASC, c.id ASC`,
    )
    .all() as LocalCustomerRow[]

  const state = new Map<string, SyncStateRow>()
  for (const row of db
    .prepare('SELECT customer_id, business_id, hash FROM customer_sync_state')
    .all() as SyncStateRow[]) {
    state.set(row.customer_id, row)
  }

  const upserts: PendingUpsert[] = []
  const live = new Set<string>()

  for (const row of rows) {
    live.add(row.id)
    const payload = toPayload(row)
    const hash = payloadHash(payload)
    if (state.get(row.id)?.hash === hash) continue
    upserts.push({ payload, hash })
  }

  // A state row with no customer behind it: deleted at the counter, and the
  // mirror has not been told yet.
  const deletes: DeletePayload[] = []
  for (const [customerId, row] of state) {
    if (live.has(customerId)) continue
    deletes.push({ local_id: customerId, business_id: row.business_id })
  }

  const pending = upserts.length + deletes.length
  return {
    upserts: upserts.slice(0, MAX_ROWS_PER_RUN),
    deletes: deletes.slice(0, MAX_ROWS_PER_RUN),
    pending,
  }
}

async function pushBatch(
  licenseKey: string,
  fingerprint: string,
  customers: CustomerPayload[],
  deleted: DeletePayload[],
): Promise<void> {
  const result = await callSupabaseRpc<SyncRpcResult>('sync_customers', {
    p_key: licenseKey,
    p_fingerprint: fingerprint,
    p_customers: customers,
    p_deleted: deleted,
  })

  if (!result.reached) {
    throw new Error(result.message)
  }
  if (!result.data?.ok) {
    throw new Error(`sync_customers refused the batch: ${result.data?.error ?? 'unknown'}`)
  }
}

/**
 * Record what went up — but only after the server confirmed it. A batch that
 * failed leaves no state behind and is simply pending again next tick.
 */
function markSynced(batch: PendingUpsert[]): void {
  const db = getDb()
  const at = new Date().toISOString()
  const upsert = db.prepare(
    `INSERT INTO customer_sync_state (customer_id, business_id, hash, synced_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(customer_id) DO UPDATE SET
       business_id = excluded.business_id,
       hash = excluded.hash,
       synced_at = excluded.synced_at`,
  )
  db.transaction(() => {
    for (const entry of batch) {
      upsert.run(entry.payload.local_id, entry.payload.business_id, entry.hash, at)
    }
  })()
}

function clearDeletedState(batch: DeletePayload[]): void {
  const db = getDb()
  const remove = db.prepare('DELETE FROM customer_sync_state WHERE customer_id = ?')
  db.transaction(() => {
    for (const entry of batch) remove.run(entry.local_id)
  })()
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
