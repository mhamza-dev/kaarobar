import { callSupabaseRpc, getSupabaseConfig } from '../config/supabase'
import {
  getLicenseEnforcement,
  setLicenseEnforcement,
  type LicenseBlockedReason,
} from '../config/store'
import { persistLocalLicense, readLocalLicense } from './service'
import { normalizeLicenseFeatures } from '../../shared/licensing/features'

/**
 * The licensing heartbeat: ask the server, every 15 minutes, whether this key
 * may still run.
 *
 * Activation happens once and then the device is on its own — which means a key
 * that is later revoked, deleted, or shortened keeps working until someone
 * reinstalls. This closes that: a till already running gets locked within one
 * tick of the server saying so.
 *
 * ## What is allowed to lock a shop
 *
 * Only an answer. `invalid_key` (the row is gone), `revoked`, `expired` — those
 * are the server's verdict and they lock the till on the spot.
 *
 * A failure to *reach* the server is not an answer, and never locks anything.
 * This is a point-of-sale app for shops that routinely have no internet for
 * days; treating a dropped connection as a revocation would stop a shop from
 * selling because their DSL is down, or because we forgot to renew a
 * certificate. The device keeps running on its last known good check.
 *
 * ## The catch, and the grace window
 *
 * If unreachable never locked anything, pulling the network cable would be a
 * free crack. So a device that has not had a *successful* check in
 * `OFFLINE_GRACE_DAYS` locks with `verification_overdue`, which one successful
 * check clears. The window is what buys back the offline shop: long enough that
 * a genuine outage is survivable, short enough that it is not a licence.
 *
 * Tune it per deployment with KAAROBAR_LICENSE_OFFLINE_GRACE_DAYS; set it to 0
 * to switch enforcement-while-offline off entirely.
 */

/** Long enough to survive a bad month of connectivity. Override per deployment. */
const DEFAULT_OFFLINE_GRACE_DAYS = 14

function offlineGraceDays(): number {
  const raw = Number(process.env.KAAROBAR_LICENSE_OFFLINE_GRACE_DAYS)
  if (!Number.isFinite(raw) || raw < 0) return DEFAULT_OFFLINE_GRACE_DAYS
  return raw
}

type VerifyRpcResult = {
  ok: boolean
  error?: string
  issuedTo?: string
  expiresAt?: string | null
  maxDevices?: number
  plan?: string | null
  features?: string[] | null
  maxUsers?: number | null
  maxTemplates?: number | null
  deviceKnown?: boolean
}

export type LicenseVerifyOutcome =
  /** The server answered and the key is good. Any previous lock is cleared. */
  | { state: 'verified' }
  /** The server answered and refused. The till is now locked. */
  | { state: 'blocked'; reason: LicenseBlockedReason }
  /** No answer. Nothing changed; the shop keeps working. */
  | { state: 'unreachable'; message: string }
  /** Nothing to check — no license installed, or a dev/unconfigured build. */
  | { state: 'skipped'; message: string }

/**
 * Server verdicts, mapped onto the reasons stored locally.
 *
 * `device_limit_reached` is intentionally absent. It is an answer about *seats*,
 * not about the key, and the heartbeat never claims a seat — so a shop cannot
 * hit it here, and if a future server did return it, locking the counter over a
 * seat count is the wrong response.
 */
const BLOCKING_ERRORS: Record<string, LicenseBlockedReason> = {
  invalid_key: 'invalid_key',
  revoked: 'revoked',
  expired: 'expired',
}

function positiveIntOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : null
}

function daysSince(iso: string | null, now: Date): number {
  if (!iso) return Number.POSITIVE_INFINITY
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return Number.POSITIVE_INFINITY
  return (now.getTime() - then) / (24 * 60 * 60 * 1000)
}

/**
 * One heartbeat. Safe to call as often as you like; it does no work when there
 * is nothing to verify.
 */
export async function verifyLicenseNow(now = new Date()): Promise<LicenseVerifyOutcome> {
  const record = readLocalLicense()
  if (!record?.licenseKey) {
    return { state: 'skipped', message: 'No license installed.' }
  }

  // A dev license was never issued by a server and has no row to check.
  if (record.mode === 'dev') {
    return { state: 'skipped', message: 'Development license.' }
  }

  if (!getSupabaseConfig()) {
    // Nothing to check against. Locking every shop because a build shipped
    // without the env vars would be our mistake charged to them.
    return { state: 'skipped', message: 'License server is not configured on this build.' }
  }

  const result = await callSupabaseRpc<VerifyRpcResult>('verify_license', {
    p_key: record.licenseKey,
    p_fingerprint: record.fingerprint,
  })

  if (!result.reached) {
    return handleUnreachable(result.message, now)
  }

  const payload = result.data
  if (!payload?.ok) {
    const code = payload?.error ?? 'unknown'
    const reason = BLOCKING_ERRORS[code]
    if (!reason) {
      // An error we do not recognise is not a verdict we are willing to lock a
      // shop over. Record it and treat the check as not having happened.
      return handleUnreachable(`verify_license returned an unknown error: ${code}`, now)
    }
    setLicenseEnforcement({
      verifiedAt: now.toISOString(),
      blockedReason: reason,
      verifyError: null,
    })
    console.warn(`[license] locked by the server: ${reason}`)
    return { state: 'blocked', reason }
  }

  // Good. Clear any lock — including a `verification_overdue` from a long
  // offline stretch, which is exactly what one successful check is for.
  setLicenseEnforcement({
    verifiedAt: now.toISOString(),
    blockedReason: null,
    verifyError: null,
  })

  adoptServerPlan(payload, now)
  return { state: 'verified' }
}

/**
 * No answer from the server. Keep the shop running, but let the grace window
 * run down.
 */
function handleUnreachable(message: string, now: Date): LicenseVerifyOutcome {
  const enforcement = getLicenseEnforcement()
  setLicenseEnforcement({ verifyError: message })

  const grace = offlineGraceDays()
  if (grace <= 0) return { state: 'unreachable', message }

  // No successful check ever recorded (an install that predates this feature)
  // starts its window now rather than locking on the first failed tick.
  if (!enforcement.verifiedAt) {
    setLicenseEnforcement({ verifiedAt: now.toISOString() })
    return { state: 'unreachable', message }
  }

  // Already locked for some other reason — leave that reason alone.
  if (enforcement.blockedReason && enforcement.blockedReason !== 'verification_overdue') {
    return { state: 'unreachable', message }
  }

  if (daysSince(enforcement.verifiedAt, now) > grace) {
    setLicenseEnforcement({ blockedReason: 'verification_overdue' })
    console.warn(
      `[license] locked: no successful check in ${grace} days (last: ${enforcement.verifiedAt})`,
    )
    return { state: 'blocked', reason: 'verification_overdue' }
  }

  return { state: 'unreachable', message }
}

/**
 * Take the plan the server reports now.
 *
 * A plan changed with `upgrade_license()` reaches the device on the next
 * heartbeat instead of waiting for someone to re-paste a key — which is what
 * the upgrade flow used to require. Only rewrites the stored record when
 * something actually differs, so the usual tick does no disk I/O.
 */
function adoptServerPlan(payload: VerifyRpcResult, now: Date): void {
  const record = readLocalLicense()
  if (!record) return

  const plan = typeof payload.plan === 'string' && payload.plan ? payload.plan : null
  const features = normalizeLicenseFeatures(payload.features)
  const expiresAt = payload.expiresAt ?? null
  const maxUsers = positiveIntOrNull(payload.maxUsers)
  const maxTemplates = positiveIntOrNull(payload.maxTemplates)

  const sameFeatures =
    (record.features ?? null) === null && features === null
      ? true
      : JSON.stringify(record.features ?? null) === JSON.stringify(features)

  const unchanged =
    (record.plan ?? null) === plan &&
    record.expiresAt === expiresAt &&
    (record.maxUsers ?? null) === maxUsers &&
    (record.maxTemplates ?? null) === maxTemplates &&
    sameFeatures

  if (unchanged) return

  persistLocalLicense({
    ...record,
    issuedTo: payload.issuedTo ?? record.issuedTo,
    expiresAt,
    maxDevices: payload.maxDevices ?? record.maxDevices,
    plan,
    features,
    maxUsers,
    maxTemplates,
    lastVerifiedAt: now.toISOString(),
  })
}
