import Store from 'electron-store'
import type { AppLanguage } from '../../shared/languages'
import type { LicenseFeature } from '../../shared/licensing/features'
import type { LicenseBlockedReason } from '../../shared/types/api'
import { getKaarobarDataDir } from './paths'

export type { AppLanguage, LicenseBlockedReason }

export type LocalLicenseRecord = {
  licenseKey: string
  fingerprint: string
  issuedTo: string
  expiresAt: string | null
  maxDevices: number
  activatedAt: string
  lastVerifiedAt: string
  mode: 'supabase' | 'dev'
  /** Plan name from the license server; null on licenses issued before plans. */
  plan?: string | null
  /** Feature entitlements; null (or absent on legacy blobs) = unrestricted. */
  features?: LicenseFeature[] | null
  /** Seat/layout limits from the server; null = plan preset / unlimited. */
  maxUsers?: number | null
  maxTemplates?: number | null
}

export type AutoBackupSettings = {
  autoBackupEnabled: boolean
  /** Local daily time as HH:MM (24h). */
  autoBackupTime: string
  lastAutoBackupAt: string | null
}

type StoreSchema = {
  language: AppLanguage
  lastBusinessId: string | null
  /** Encrypted payload produced by licensing/crypto.ts */
  licenseBlob: string | null
  setupComplete: boolean
  autoBackupEnabled: boolean
  autoBackupTime: string
  lastAutoBackupAt: string | null
  /** Receipt printer (see receipt/posPrinterSettings.ts). */
  posPrintEnabled: boolean
  posPrinterName: string
  posPaperWidth: string
  posSilent: boolean
  posCopies: number
  posTransport: string
  posTemplate: string
  /** Cloud license heartbeat — see licensing/remoteVerify.ts. */
  licenseVerifiedAt: string | null
  licenseBlockedReason: string | null
  licenseVerifyError: string | null
  /** Customer cloud sync — see sync/customerSync.ts. */
  customerSyncedAt: string | null
  customerSyncError: string | null
}

export const appStore = new Store<StoreSchema>({
  name: 'kaarobar-config',
  cwd: getKaarobarDataDir(),
  defaults: {
    language: 'en',
    lastBusinessId: null,
    licenseBlob: null,
    setupComplete: false,
    autoBackupEnabled: false,
    autoBackupTime: '22:00',
    lastAutoBackupAt: null,
    // On by default: this is a point-of-sale app, so a sale receipt should go to
    // the receipt printer. If POS printing fails for any reason the caller falls
    // back to the HTML preview window, which is the pre-existing behaviour.
    posPrintEnabled: true,
    posPrinterName: '',
    posPaperWidth: '80mm',
    posSilent: true,
    posCopies: 1,
    // Raw ESC/POS by default: thermal printers are commonly installed as
    // passthrough queues, where rendered output prints as PostScript source.
    posTransport: 'raw',
    posTemplate: 'classic',
    licenseVerifiedAt: null,
    licenseBlockedReason: null,
    licenseVerifyError: null,
    customerSyncedAt: null,
    customerSyncError: null,
  },
})

const BLOCKED_REASONS: LicenseBlockedReason[] = [
  'invalid_key',
  'revoked',
  'expired',
  'verification_overdue',
]

export type LicenseEnforcement = {
  /** Last time the server answered at all — the clock the grace window runs on. */
  verifiedAt: string | null
  /** Set = the till is locked. Null = running. */
  blockedReason: LicenseBlockedReason | null
  /** Last failure to reach the server. Diagnostic only; never blocks by itself. */
  verifyError: string | null
}

export function getLicenseEnforcement(): LicenseEnforcement {
  const stored = appStore.get('licenseBlockedReason')
  const blockedReason = BLOCKED_REASONS.find((reason) => reason === stored) ?? null
  return {
    verifiedAt: appStore.get('licenseVerifiedAt') ?? null,
    blockedReason,
    verifyError: appStore.get('licenseVerifyError') ?? null,
  }
}

export function setLicenseEnforcement(patch: Partial<LicenseEnforcement>): void {
  if (patch.verifiedAt !== undefined) appStore.set('licenseVerifiedAt', patch.verifiedAt)
  if (patch.blockedReason !== undefined) appStore.set('licenseBlockedReason', patch.blockedReason)
  if (patch.verifyError !== undefined) appStore.set('licenseVerifyError', patch.verifyError)
}

/**
 * Wipe the lock. Called when a key is activated successfully — a shop that has
 * just pasted a working key must not stay locked by the verdict on the old one.
 */
export function clearLicenseEnforcement(): void {
  setLicenseEnforcement({
    verifiedAt: new Date().toISOString(),
    blockedReason: null,
    verifyError: null,
  })
}

export type CustomerSyncState = {
  /** Last run that pushed everything pending, or found nothing to push. */
  syncedAt: string | null
  error: string | null
}

export function getCustomerSyncState(): CustomerSyncState {
  return {
    syncedAt: appStore.get('customerSyncedAt') ?? null,
    error: appStore.get('customerSyncError') ?? null,
  }
}

export function setCustomerSyncState(patch: Partial<CustomerSyncState>): void {
  if (patch.syncedAt !== undefined) appStore.set('customerSyncedAt', patch.syncedAt)
  if (patch.error !== undefined) appStore.set('customerSyncError', patch.error)
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/

export function normalizeAutoBackupTime(value: string | undefined | null): string {
  if (value && TIME_RE.test(value)) return value
  return '22:00'
}

export function getAutoBackupSettings(): AutoBackupSettings {
  return {
    autoBackupEnabled: Boolean(appStore.get('autoBackupEnabled')),
    autoBackupTime: normalizeAutoBackupTime(appStore.get('autoBackupTime')),
    lastAutoBackupAt: appStore.get('lastAutoBackupAt') ?? null,
  }
}

export function setAutoBackupSettings(payload: {
  autoBackupEnabled?: boolean
  autoBackupTime?: string
}): AutoBackupSettings {
  if (typeof payload.autoBackupEnabled === 'boolean') {
    appStore.set('autoBackupEnabled', payload.autoBackupEnabled)
  }
  if (payload.autoBackupTime !== undefined) {
    appStore.set('autoBackupTime', normalizeAutoBackupTime(payload.autoBackupTime))
  }
  return getAutoBackupSettings()
}

export function markAutoBackupCompleted(at = new Date().toISOString()): void {
  appStore.set('lastAutoBackupAt', at)
}
