import { app } from 'electron'
import { appStore, type LocalLicenseRecord } from '../config/store'
import { getDb, isDatabaseOpen } from '../db/connection'
import {
  decryptLicenseRecordFlexible,
  encryptLicenseRecord,
  getDeviceFingerprint,
  isLicenseExpired,
} from './crypto'
import type { LicenseActivateResult } from '../../shared/types/api'
import {
  licensePlanRank,
  normalizeLicenseFeatures,
  resolveLicenseLimits,
  type LicenseFeature,
} from '../../shared/licensing/features'

type RpcResult = {
  ok: boolean
  error?: string
  issuedTo?: string
  expiresAt?: string | null
  maxDevices?: number
  plan?: string | null
  features?: string[] | null
  maxUsers?: number | null
  maxTemplates?: number | null
}

function positiveIntOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : null
}

export type LicenseStatus =
  | { status: 'none' }
  | { status: 'valid'; record: LocalLicenseRecord }
  | { status: 'expired'; record: LocalLicenseRecord }

type LicenseRow = {
  license_key: string
  expires_at: string | null
  issued_to: string | null
  fingerprint: string
  activated_at: string
  blob: string
}

let fingerprintRebindInFlight: Promise<void> | null = null
const reboundLicenseKeys = new Set<string>()

/**
 * Decrypt cache keyed by the exact blob string. Nearly every guarded IPC call
 * re-reads the license; decrypting (and worse, deriving the key) each time is
 * measurable per request. Keying by blob content makes invalidation automatic:
 * a new activation writes a new blob, which simply misses the cache.
 */
let decryptCacheBlob: string | null = null
let decryptCacheResult: { record: LocalLicenseRecord; migratedFromLegacy: boolean } | null = null

function decryptBlobCached(
  blob: string,
): { record: LocalLicenseRecord; migratedFromLegacy: boolean } | null {
  if (blob === decryptCacheBlob) {
    // Migration adoption already happened on the first decrypt of this blob.
    return decryptCacheResult ? { record: decryptCacheResult.record, migratedFromLegacy: false } : null
  }
  const result = decryptLicenseRecordFlexible(blob)
  decryptCacheBlob = blob
  decryptCacheResult = result
  return result
}

function getSupabaseConfig() {
  const url = process.env.KAAROBAR_SUPABASE_URL
  const anonKey = process.env.KAAROBAR_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  return { url, anonKey }
}

function writeLicenseToStore(record: LocalLicenseRecord): string {
  const blob = encryptLicenseRecord(record)
  appStore.set('licenseBlob', blob)
  // Prime the decrypt cache so the very next read skips the crypto entirely.
  decryptCacheBlob = blob
  decryptCacheResult = { record, migratedFromLegacy: false }
  return blob
}

function writeLicenseToDb(record: LocalLicenseRecord, blob: string): void {
  if (!isDatabaseOpen()) return
  const now = new Date().toISOString()
  getDb()
    .prepare(
      `INSERT INTO app_license (id, license_key, expires_at, issued_to, fingerprint, activated_at, updated_at, blob)
       VALUES ('local', ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         license_key = excluded.license_key,
         expires_at = excluded.expires_at,
         issued_to = excluded.issued_to,
         fingerprint = excluded.fingerprint,
         activated_at = excluded.activated_at,
         updated_at = excluded.updated_at,
         blob = excluded.blob`,
    )
    .run(
      record.licenseKey,
      record.expiresAt,
      record.issuedTo,
      record.fingerprint,
      record.activatedAt,
      now,
      blob,
    )
}

/** Persist license to electron-store always; also upsert SQLite when DB is open. */
export function persistLocalLicense(record: LocalLicenseRecord): void {
  const blob = writeLicenseToStore(record)
  writeLicenseToDb(record, blob)
}

/**
 * After migrating a legacy local license to the stable fingerprint, re-bind with the
 * license server once so the same machine does not consume an extra device seat under
 * the old hash only.
 */
function scheduleFingerprintServerRebind(record: LocalLicenseRecord): void {
  if (record.mode === 'dev') return
  if (!record.licenseKey || reboundLicenseKeys.has(record.licenseKey)) return
  if (fingerprintRebindInFlight) return

  fingerprintRebindInFlight = activateLicense(record.licenseKey)
    .then((result) => {
      if (result.ok) {
        reboundLicenseKeys.add(record.licenseKey)
        return
      }
      // Local license already uses the stable fingerprint; server rebind can retry next boot.
      if (result.error === 'device_limit_reached' || result.error === 'offline' || result.error === 'network_error') {
        return
      }
    })
    .catch(() => {
      // Ignore — offline / transient; local license remains valid.
    })
    .finally(() => {
      fingerprintRebindInFlight = null
    })
}

function adoptDecryptedLicense(
  result: { record: LocalLicenseRecord; migratedFromLegacy: boolean } | null,
): LocalLicenseRecord | null {
  if (!result) return null
  if (result.migratedFromLegacy) {
    persistLocalLicense(result.record)
    scheduleFingerprintServerRebind(result.record)
  }
  return result.record
}

/** Ensure current store/DB license is written into app_license (call after openDatabase). */
export function flushLicenseToDatabase(): void {
  if (!isDatabaseOpen()) return
  const record = readLocalLicense()
  if (!record) return
  const blob = appStore.get('licenseBlob') || encryptLicenseRecord(record)
  writeLicenseToDb(record, blob)
}

function readLicenseRow(): LicenseRow | null {
  if (!isDatabaseOpen()) return null
  try {
    const row = getDb()
      .prepare(
        `SELECT license_key, expires_at, issued_to, fingerprint, activated_at, blob
         FROM app_license WHERE id = 'local'`,
      )
      .get() as LicenseRow | undefined
    return row ?? null
  } catch {
    return null
  }
}

function recordFromStoreBlob(): LocalLicenseRecord | null {
  const blob = appStore.get('licenseBlob')
  if (!blob) return null
  return adoptDecryptedLicense(decryptBlobCached(blob))
}

function recordFromRow(row: LicenseRow): LocalLicenseRecord | null {
  const decrypted = adoptDecryptedLicense(decryptBlobCached(row.blob))
  if (decrypted) return decrypted

  // Blob may fail after hardware/fingerprint change — still surface denormalized expiry/key.
  return {
    licenseKey: row.license_key,
    fingerprint: row.fingerprint,
    issuedTo: row.issued_to || 'Licensed Customer',
    expiresAt: row.expires_at,
    maxDevices: 1,
    activatedAt: row.activated_at,
    lastVerifiedAt: row.activated_at,
    mode: 'supabase',
  }
}

/** Returns stored license even if expired. Prefers DB; migrates from store when needed. */
export function readLocalLicense(): LocalLicenseRecord | null {
  const row = readLicenseRow()
  if (row) return recordFromRow(row)

  const fromStore = recordFromStoreBlob()
  if (fromStore && isDatabaseOpen()) {
    persistLocalLicense(fromStore)
  }
  return fromStore
}

export function readValidLocalLicense(): LocalLicenseRecord | null {
  const status = getLicenseStatus()
  return status.status === 'valid' ? status.record : null
}

export function getLicenseStatus(): LicenseStatus {
  const record = readLocalLicense()
  if (!record?.licenseKey) return { status: 'none' }
  if (isLicenseExpired(record)) return { status: 'expired', record }
  return { status: 'valid', record }
}

/**
 * Feature entitlements of the installed license. `null` = unrestricted —
 * either a legacy license issued before plans existed, or a fallback record
 * whose blob could not be decrypted (validity gating still applies there).
 */
export function getLicenseFeatures(): LicenseFeature[] | null {
  return readLocalLicense()?.features ?? null
}

export function getLicensePlan(): string | null {
  return readLocalLicense()?.plan ?? null
}

/**
 * Effective seat/receipt-layout limits of the installed license. Legacy
 * licenses (no plan) — and a missing license, whose validity other guards
 * already enforce — are unlimited.
 */
export function getLicenseLimits(): { maxUsers: number; maxTemplates: number } {
  const record = readLocalLicense()
  return resolveLicenseLimits(record?.plan ?? null, record?.maxUsers, record?.maxTemplates)
}

function mapRpcError(error: string): LicenseActivateResult {
  const known = ['invalid_key', 'revoked', 'expired', 'device_limit_reached'] as const
  const matched = known.find((code) => code === error)
  if (!matched) return { ok: false, error: 'unknown', message: `Activation failed: ${error}` }

  const messageMap: Record<typeof matched, string> = {
    invalid_key: 'This license key is not valid.',
    revoked: 'This license has been revoked. Contact support.',
    expired: 'This license has expired.',
    device_limit_reached: 'This license has reached its device limit.',
  }
  return { ok: false, error: matched, message: messageMap[matched] }
}

export async function activateLicense(licenseKey: string): Promise<LicenseActivateResult> {
  const key = licenseKey.trim()
  const fingerprint = getDeviceFingerprint()
  const supabase = getSupabaseConfig()

  if (!supabase) {
    if (!app.isPackaged && key === 'KAAROBAR-DEV-LOCAL') {
      const now = new Date().toISOString()
      const record: LocalLicenseRecord = {
        licenseKey: key,
        fingerprint,
        issuedTo: 'Local Development',
        expiresAt: null,
        maxDevices: 1,
        activatedAt: now,
        lastVerifiedAt: now,
        mode: 'dev',
        plan: 'full',
        features: null,
      }
      persistLocalLicense(record)
      return {
        ok: true,
        issuedTo: record.issuedTo,
        expiresAt: null,
        maxDevices: 1,
        mode: 'dev',
        plan: 'full',
        features: null,
      }
    }

    return {
      ok: false,
      error: 'network_error',
      message:
        'License server is not configured. Set KAAROBAR_SUPABASE_URL and KAAROBAR_SUPABASE_ANON_KEY, or use KAAROBAR-DEV-LOCAL in development.',
    }
  }

  try {
    const rpcUrl = `${supabase.url.replace(/\/$/, '')}/rest/v1/rpc/validate_and_activate_license`
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        apikey: supabase.anonKey,
        Authorization: `Bearer ${supabase.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key: key,
        p_fingerprint: fingerprint,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        ok: false,
        error: 'network_error',
        message: errorText || `License server request failed (${response.status})`,
      }
    }

    const result = (await response.json()) as RpcResult
    if (!result?.ok) return mapRpcError(result?.error ?? 'unknown')

    // Plan downgrades are not allowed while a valid license is installed —
    // a fresh/expired device may activate any key.
    const current = getLicenseStatus()
    if (current.status === 'valid' && current.record.licenseKey !== key) {
      const newPlan = typeof result.plan === 'string' && result.plan ? result.plan : null
      if (licensePlanRank(newPlan) < licensePlanRank(current.record.plan ?? null)) {
        return {
          ok: false,
          error: 'downgrade_blocked',
          message:
            'This key is for a lower plan than your current license. Plan downgrades are not allowed — contact support if you need to switch.',
        }
      }
    }

    const now = new Date().toISOString()
    const record: LocalLicenseRecord = {
      licenseKey: key,
      fingerprint,
      issuedTo: result.issuedTo ?? 'Licensed Customer',
      expiresAt: result.expiresAt ?? null,
      maxDevices: result.maxDevices ?? 1,
      activatedAt: now,
      lastVerifiedAt: now,
      mode: 'supabase',
      plan: typeof result.plan === 'string' && result.plan ? result.plan : null,
      // Servers running the pre-plan RPC omit `features` — null keeps those
      // licenses unrestricted instead of locking everything out.
      features: normalizeLicenseFeatures(result.features),
      maxUsers: positiveIntOrNull(result.maxUsers),
      maxTemplates: positiveIntOrNull(result.maxTemplates),
    }
    persistLocalLicense(record)
    reboundLicenseKeys.add(key)

    return {
      ok: true,
      issuedTo: record.issuedTo,
      expiresAt: record.expiresAt,
      maxDevices: record.maxDevices,
      mode: 'supabase',
      plan: record.plan ?? null,
      features: record.features ?? null,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network request failed'
    const offline = /fetch|network|ENOTFOUND|ECONNREFUSED/i.test(message)
    return {
      ok: false,
      error: offline ? 'offline' : 'network_error',
      message: offline ? 'No internet connection. License activation requires internet once.' : message,
    }
  }
}
