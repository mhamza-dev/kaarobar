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
