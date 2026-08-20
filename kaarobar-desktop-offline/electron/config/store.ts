import Store from 'electron-store'
import type { AppLanguage } from '../../shared/languages'
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
