import Store from 'electron-store'
import type { AppLanguage } from '../../shared/languages'
import type { LicenseFeature } from '../../shared/licensing/features'
import { getKaarobarDataDir } from './paths'

export type { AppLanguage }

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
  },
})

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
