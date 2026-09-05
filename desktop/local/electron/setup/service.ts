import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { appStore } from '../config/store'
import { normalizeAppLanguage } from '../../shared/languages'
import { dbExists, closeDatabase, getDb, openDatabase } from '../db/connection'
import { runMigrations } from '../db/migrations'
import {
  activateLicense,
  flushLicenseToDatabase,
  getLicenseStatus,
  readValidLocalLicense,
} from '../licensing/service'
import {
  installEncryptedBackup,
  syncActiveBusinessAfterRestore,
  type BackupProgressReporter,
} from '../backup/service'
import type { BootState, CompleteSetupPayload, CompleteSetupResult } from '../../shared/types/api'
import { normalizeBusinessNature } from '../../shared/businessNature'
import { getKaarobarDataDir } from '../config/paths'

function nowIso(): string {
  return new Date().toISOString()
}

export function getBootState(): BootState {
  try {
    fs.mkdirSync(getKaarobarDataDir(), { recursive: true })
    const setupComplete = appStore.get('setupComplete')
    const language = normalizeAppLanguage(appStore.get('language'))

    // First install only — do not fold expired/missing license into the full wizard.
    if (!setupComplete || !dbExists()) {
      return { status: 'needs_setup' }
    }

    openDatabase()
    runMigrations(getDb())
    flushLicenseToDatabase()

    const licenseStatus = getLicenseStatus()
    if (licenseStatus.status === 'none') {
      return { status: 'needs_license' }
    }
    // Revoked, deleted server-side, or overdue a check: there is no license to
    // boot with, so the same gate as a device that never had one.
    if (licenseStatus.status === 'blocked') {
      return { status: 'needs_license' }
    }
    if (licenseStatus.status === 'expired') {
      return {
        status: 'license_expired',
        expiresAt: licenseStatus.record.expiresAt,
        issuedTo: licenseStatus.record.issuedTo,
      }
    }

    return { status: 'needs_login', language }
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to boot application',
    }
  }
}

const DEFAULT_BOOT_BRAND_COLOR = '#2d6df6'

/** Brand color for login / license chrome before a session exists. No auth required. */
export function getBootBrandColor(): string {
  try {
    if (!appStore.get('setupComplete') || !dbExists()) return DEFAULT_BOOT_BRAND_COLOR
    openDatabase()
    runMigrations(getDb())
    const lastId = appStore.get('lastBusinessId')
    if (lastId) {
      const row = getDb()
        .prepare('SELECT brand_color FROM businesses WHERE id = ?')
        .get(lastId) as { brand_color: string } | undefined
      if (row?.brand_color?.trim()) return row.brand_color.trim()
    }
    const first = getDb()
      .prepare('SELECT brand_color FROM businesses ORDER BY created_at ASC LIMIT 1')
      .get() as { brand_color: string } | undefined
    return first?.brand_color?.trim() || DEFAULT_BOOT_BRAND_COLOR
  } catch {
    return DEFAULT_BOOT_BRAND_COLOR
  }
}

export async function completeSetup(payload: CompleteSetupPayload): Promise<CompleteSetupResult> {
  try {
    fs.mkdirSync(getKaarobarDataDir(), { recursive: true })
    let license = readValidLocalLicense()
    if (!license || license.licenseKey !== payload.licenseKey.trim()) {
      const activation = await activateLicense(payload.licenseKey)
      if (!activation.ok) return { ok: false, error: activation.error, message: activation.message }
      license = readValidLocalLicense()
    }

    if (!license) {
      return { ok: false, error: 'license_missing', message: 'License activation could not be saved locally.' }
    }

    if (dbExists() && appStore.get('setupComplete')) {
      return { ok: false, error: 'already_setup', message: 'Setup has already been completed on this device.' }
    }

    closeDatabase()
    const db = openDatabase()
    runMigrations(db)
    flushLicenseToDatabase()

    const ownerId = uuidv4()
    const businessId = uuidv4()
    const branchId = uuidv4()
    const createdAt = nowIso()
    const passwordHash = bcrypt.hashSync(payload.owner.password, 12)

    db.transaction(() => {
      db.prepare(
        `INSERT INTO users (id, business_id, branch_id, name, email, password_hash, role, is_active, created_at)
         VALUES (?, NULL, NULL, ?, ?, ?, 'owner', 1, ?)`,
      ).run(ownerId, payload.owner.name.trim(), payload.owner.email.trim().toLowerCase(), passwordHash, createdAt)

      db.prepare(
        `INSERT INTO businesses (
           id, owner_id, name, currency, brand_color, business_nature, logo_path,
           receipt_header, receipt_footer,
           is_active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)`,
      ).run(
        businessId,
        ownerId,
        payload.business.name.trim(),
        payload.business.currency.trim() || 'PKR',
        payload.business.brandColor,
        normalizeBusinessNature(payload.business.businessNature),
        'Thank you for shopping with us',
        createdAt,
        createdAt,
      )

      db.prepare(
        `INSERT INTO branches (id, business_id, name, address, phone, is_main_branch, is_active, created_at)
         VALUES (?, ?, ?, ?, ?, 1, 1, ?)`,
      ).run(
        branchId,
        businessId,
        payload.branch.name.trim(),
        payload.branch.address.trim() || null,
        payload.branch.phone.trim() || null,
        createdAt,
      )

      db.prepare('INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)').run(
        '',
        'language',
        normalizeAppLanguage(payload.language),
      )
      db.prepare('INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)').run(
        businessId,
        'receipt_footer',
        'Thank you for shopping with us',
      )
      db.prepare('INSERT INTO settings (business_id, key, value) VALUES (?, ?, ?)').run(
        businessId,
        'idle_lock_minutes',
        '10',
      )
    })()

    // Flush again after seed so license row is definitely present.
    flushLicenseToDatabase()

    appStore.set('setupComplete', true)
    appStore.set('language', normalizeAppLanguage(payload.language))
    appStore.set('lastBusinessId', businessId)
    fs.writeFileSync(path.join(getKaarobarDataDir(), 'setup.complete'), nowIso(), 'utf8')

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: 'setup_failed',
      message: error instanceof Error ? error.message : 'Setup failed',
    }
  }
}

export async function restoreSetupFromBackup(
  payload: {
    filePath: string
    licenseKey: string
  },
  onProgress?: BackupProgressReporter,
): Promise<CompleteSetupResult> {
  try {
    fs.mkdirSync(getKaarobarDataDir(), { recursive: true })

    if (dbExists() && appStore.get('setupComplete')) {
      return { ok: false, error: 'already_setup', message: 'Setup has already been completed on this device.' }
    }

    let license = readValidLocalLicense()
    if (!license || license.licenseKey !== payload.licenseKey.trim()) {
      const activation = await activateLicense(payload.licenseKey)
      if (!activation.ok) return { ok: false, error: activation.error, message: activation.message }
      license = readValidLocalLicense()
    }
    if (!license) {
      return { ok: false, error: 'license_missing', message: 'License activation could not be saved locally.' }
    }

    await installEncryptedBackup(payload.filePath, onProgress)
    onProgress?.({ operation: 'restore', phase: 'finalizing', percent: 99 })
    flushLicenseToDatabase()

    const db = getDb()
    const languageRow = db
      .prepare(`SELECT value FROM settings WHERE key = 'language' ORDER BY business_id ASC LIMIT 1`)
      .get() as { value: string } | undefined
    const language = normalizeAppLanguage(languageRow?.value)

    syncActiveBusinessAfterRestore()

    appStore.set('setupComplete', true)
    appStore.set('language', language)
    fs.writeFileSync(path.join(getKaarobarDataDir(), 'setup.complete'), nowIso(), 'utf8')
    onProgress?.({ operation: 'restore', phase: 'finalizing', percent: 100 })

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: 'setup_failed',
      message: error instanceof Error ? error.message : 'Failed to restore from backup',
    }
  }
}
