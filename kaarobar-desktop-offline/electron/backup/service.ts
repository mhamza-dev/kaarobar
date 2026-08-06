import { dialog } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import JSZip from 'jszip'
import { logout } from '../auth/service'
import { requirePermission } from '../auth/guards'
import { appStore } from '../config/store'
import { getAssetsDir } from '../config/paths'
import { closeDatabase, getDb, getDbPath, openDatabase } from '../db/connection'
import { runMigrations } from '../db/migrations'
import { decryptBackupPayload, encryptBackupPayload } from './crypto'
import type { BackupProgressEvent, BackupProgressPhase } from '../../shared/types/api'

const BACKUP_FORMAT_VERSION = 2
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'utf8')
const ZIP_LOCAL_HEADER = Buffer.from([0x50, 0x4b, 0x03, 0x04])

type BackupManifest = {
  formatVersion: number
  app: 'kaarobar'
  createdAt: string
  includes: Array<'db' | 'files'>
}

export type BackupProgressReporter = (event: BackupProgressEvent) => void

function reportProgress(
  onProgress: BackupProgressReporter | undefined,
  operation: BackupProgressEvent['operation'],
  phase: BackupProgressPhase,
  percent: number,
): void {
  if (!onProgress) return
  onProgress({
    operation,
    phase,
    percent: Math.max(0, Math.min(100, Math.round(percent))),
  })
}

function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  if (inMax <= inMin) return outMax
  const t = Math.max(0, Math.min(1, (value - inMin) / (inMax - inMin)))
  return outMin + t * (outMax - outMin)
}

async function yieldToEventLoop(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve))
}

/** Point app settings at the restored shop (single-shop: first active business). */
export function syncActiveBusinessAfterRestore(): string | null {
  const business = getDb()
    .prepare(`SELECT id FROM businesses WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1`)
    .get() as { id: string } | undefined
  const businessId = business?.id ?? null
  appStore.set('lastBusinessId', businessId)
  return businessId
}

function ensureBackupDir(): string {
  const backupDir = path.join(app.getPath('documents'), 'KaarobarBackups')
  fs.mkdirSync(backupDir, { recursive: true })
  return backupDir
}

const LATEST_BACKUP_FILENAME = 'kaarobar-latest.kaarobar-backup'

/** Delete older timestamped/other `.kaarobar-backup` files, keeping the latest file. */
function pruneOlderBackups(backupDir: string, keepFileName: string): void {
  for (const entry of fs.readdirSync(backupDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue
    if (!entry.name.endsWith('.kaarobar-backup')) continue
    if (entry.name === keepFileName) continue
    fs.unlinkSync(path.join(backupDir, entry.name))
  }
}

function removeSidecarFiles(dbPath: string): void {
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${dbPath}${suffix}`
    if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar)
  }
}

function checkpointAndReadDb(): Buffer {
  const database = getDb()
  database.pragma('wal_checkpoint(TRUNCATE)')
  const source = getDbPath()
  closeDatabase()
  return fs.readFileSync(source)
}

function writeDecryptedDb(sqliteBytes: Buffer): void {
  closeDatabase()
  const target = getDbPath()
  fs.mkdirSync(path.dirname(target), { recursive: true })
  removeSidecarFiles(target)
  fs.writeFileSync(target, sqliteBytes)
  const db = openDatabase()
  runMigrations(db)
}

function isZipPayload(bytes: Buffer): boolean {
  return bytes.length >= 4 && bytes.subarray(0, 4).equals(ZIP_LOCAL_HEADER)
}

function isSqlitePayload(bytes: Buffer): boolean {
  return bytes.length >= 16 && bytes.subarray(0, 16).equals(SQLITE_HEADER)
}

/** Walk assets dir and return relative posix paths + absolute paths. */
function listAssetFiles(root: string): Array<{ relativePosix: string; absolute: string }> {
  if (!fs.existsSync(root)) return []
  const out: Array<{ relativePosix: string; absolute: string }> = []

  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const absolute = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(absolute)
        continue
      }
      if (!entry.isFile()) continue
      const relativePosix = path.relative(root, absolute).split(path.sep).join('/')
      if (!relativePosix || relativePosix.includes('..')) continue
      out.push({ relativePosix, absolute })
    }
  }

  walk(root)
  return out
}

function removeDirContents(dir: string): void {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name)
    fs.rmSync(target, { recursive: true, force: true })
  }
}

/**
 * Normalize a stored asset path to relative form under the media root
 * (e.g. logos/x.png). Rewrites absolute paths from other machines/installs.
 */
export function normalizeStoredAssetPath(stored: string | null | undefined): string | null {
  if (stored == null) return null
  const trimmed = stored.trim()
  if (!trimmed) return null

  const normalized = trimmed.replace(/\\/g, '/')
  const assetsMarker = '/assets/'
  const markerIdx = normalized.toLowerCase().lastIndexOf(assetsMarker)
  if (markerIdx >= 0) {
    const relative = normalized.slice(markerIdx + assetsMarker.length).replace(/^\/+/, '')
    return relative || null
  }

  // Already relative (logos/…, products/…)
  if (!path.isAbsolute(trimmed) && !/^[a-zA-Z]:[\\/]/.test(trimmed) && !normalized.startsWith('/')) {
    return normalized.replace(/^\/+/, '')
  }

  // Absolute without /assets/ — try logos|products segment
  const match = normalized.match(/\/((?:logos|products)\/[^/]+)$/i)
  if (match?.[1]) return match[1]

  return null
}

/** After restore, rewrite any absolute image/logo paths to relative media-root paths. */
function rewriteAbsoluteAssetPathsInDb(): void {
  const db = getDb()
  const productRows = db
    .prepare(`SELECT id, image_path FROM products WHERE image_path IS NOT NULL AND image_path != ''`)
    .all() as Array<{ id: string; image_path: string }>
  const updateProduct = db.prepare(`UPDATE products SET image_path = ? WHERE id = ?`)
  for (const row of productRows) {
    const next = normalizeStoredAssetPath(row.image_path)
    if (next !== row.image_path) updateProduct.run(next, row.id)
  }

  const userRows = db
    .prepare(`SELECT id, image_path FROM users WHERE image_path IS NOT NULL AND image_path != ''`)
    .all() as Array<{ id: string; image_path: string }>
  const updateUser = db.prepare(`UPDATE users SET image_path = ? WHERE id = ?`)
  for (const row of userRows) {
    const next = normalizeStoredAssetPath(row.image_path)
    if (next !== row.image_path) updateUser.run(next, row.id)
  }

  const businessRows = db
    .prepare(`SELECT id, logo_path FROM businesses WHERE logo_path IS NOT NULL AND logo_path != ''`)
    .all() as Array<{ id: string; logo_path: string }>
  const updateBusiness = db.prepare(`UPDATE businesses SET logo_path = ? WHERE id = ?`)
  for (const row of businessRows) {
    const next = normalizeStoredAssetPath(row.logo_path)
    if (next !== row.logo_path) updateBusiness.run(next, row.id)
  }
}

async function buildBackupArchive(
  sqliteBytes: Buffer,
  onProgress?: BackupProgressReporter,
): Promise<Buffer> {
  const zip = new JSZip()
  const manifest: BackupManifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    app: 'kaarobar',
    createdAt: new Date().toISOString(),
    includes: ['db', 'files'],
  }
  zip.file('manifest.json', JSON.stringify(manifest, null, 2))
  zip.file('db/kaarobar.sqlite', sqliteBytes)

  const assetsRoot = getAssetsDir()
  const assetFiles = listAssetFiles(assetsRoot)
  const total = Math.max(assetFiles.length, 1)
  for (let i = 0; i < assetFiles.length; i++) {
    const file = assetFiles[i]!
    zip.file(`files/${file.relativePosix}`, fs.readFileSync(file.absolute))
    if (i === 0 || i === assetFiles.length - 1 || i % 8 === 0) {
      reportProgress(onProgress, 'create', 'packing_files', mapRange(i + 1, 0, total, 8, 50))
      await yieldToEventLoop()
    }
  }
  if (assetFiles.length === 0) {
    reportProgress(onProgress, 'create', 'packing_files', 50)
  }

  reportProgress(onProgress, 'create', 'compressing', 50)
  const archived = await zip.generateAsync(
    {
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      reportProgress(onProgress, 'create', 'compressing', mapRange(metadata.percent, 0, 100, 50, 75))
    },
  )
  return Buffer.from(archived)
}

async function restoreAssetsFromArchive(
  zip: JSZip,
  onProgress?: BackupProgressReporter,
): Promise<void> {
  const assetsRoot = getAssetsDir()
  const stagingRoot = `${assetsRoot}.restore-tmp`
  fs.rmSync(stagingRoot, { recursive: true, force: true })
  fs.mkdirSync(stagingRoot, { recursive: true })

  const fileEntries = Object.values(zip.files).filter(
    (f) => !f.dir && (f.name.startsWith('files/') || f.name.startsWith('assets/')),
  )
  const total = Math.max(fileEntries.length, 1)

  for (let i = 0; i < fileEntries.length; i++) {
    const entry = fileEntries[i]!
    const prefix = entry.name.startsWith('files/') ? 'files/' : 'assets/'
    const relativePosix = entry.name.slice(prefix.length).replace(/^\/+/, '')
    if (!relativePosix || relativePosix.includes('..')) continue
    const absolute = path.resolve(stagingRoot, ...relativePosix.split('/'))
    const stagingResolved = path.resolve(stagingRoot)
    const stagingWithSep = stagingResolved.endsWith(path.sep)
      ? stagingResolved
      : stagingResolved + path.sep
    if (absolute !== stagingResolved && !absolute.startsWith(stagingWithSep)) {
      continue
    }
    fs.mkdirSync(path.dirname(absolute), { recursive: true })
    fs.writeFileSync(absolute, Buffer.from(await entry.async('nodebuffer')))
    if (i === 0 || i === fileEntries.length - 1 || i % 8 === 0) {
      reportProgress(onProgress, 'restore', 'restoring_files', mapRange(i + 1, 0, total, 42, 88))
      await yieldToEventLoop()
    }
  }
  if (fileEntries.length === 0) {
    reportProgress(onProgress, 'restore', 'restoring_files', 88)
  }

  // Replace live assets with restored set (empty archive → clear media folder).
  fs.mkdirSync(assetsRoot, { recursive: true })
  removeDirContents(assetsRoot)
  if (fs.existsSync(stagingRoot)) {
    for (const entry of fs.readdirSync(stagingRoot, { withFileTypes: true })) {
      fs.renameSync(path.join(stagingRoot, entry.name), path.join(assetsRoot, entry.name))
    }
  }
  fs.rmSync(stagingRoot, { recursive: true, force: true })
}

async function restoreFromArchive(
  archiveBytes: Buffer,
  onProgress?: BackupProgressReporter,
): Promise<void> {
  reportProgress(onProgress, 'restore', 'extracting', 20)
  const zip = await JSZip.loadAsync(archiveBytes)
  reportProgress(onProgress, 'restore', 'extracting', 28)

  const dbEntry =
    zip.file('db/kaarobar.sqlite') ??
    zip.file('kaarobar.sqlite') ??
    Object.values(zip.files).find((f) => !f.dir && f.name.endsWith('.sqlite'))

  if (!dbEntry || dbEntry.dir) {
    throw new Error('Invalid backup archive: database file missing')
  }

  reportProgress(onProgress, 'restore', 'installing_db', 30)
  const sqliteBytes = Buffer.from(await dbEntry.async('nodebuffer'))
  if (!isSqlitePayload(sqliteBytes)) {
    throw new Error('Invalid backup archive: database is not SQLite')
  }
  writeDecryptedDb(sqliteBytes)
  reportProgress(onProgress, 'restore', 'installing_db', 42)
  await restoreAssetsFromArchive(zip, onProgress)
  reportProgress(onProgress, 'restore', 'finalizing', 90)
  rewriteAbsoluteAssetPathsInDb()
  reportProgress(onProgress, 'restore', 'finalizing', 98)
}

let backupBusy = false

export function isBackupBusy(): boolean {
  return backupBusy
}

/** Creates a backup without auth checks — used by the auto-backup scheduler. */
export async function createBackupInternal(
  onProgress?: BackupProgressReporter,
): Promise<{ ok: true; filePath: string }> {
  if (backupBusy) throw new Error('A backup operation is already in progress')
  backupBusy = true
  openDatabase()
  try {
    reportProgress(onProgress, 'create', 'prepare_db', 2)
    const sqliteBytes = checkpointAndReadDb()
    reportProgress(onProgress, 'create', 'prepare_db', 8)
    await yieldToEventLoop()

    const archiveBytes = await buildBackupArchive(sqliteBytes, onProgress)

    reportProgress(onProgress, 'create', 'encrypting', 76)
    await yieldToEventLoop()
    const encrypted = encryptBackupPayload(archiveBytes)
    reportProgress(onProgress, 'create', 'encrypting', 90)

    reportProgress(onProgress, 'create', 'writing', 92)
    const backupDir = ensureBackupDir()
    const target = path.join(backupDir, LATEST_BACKUP_FILENAME)
    fs.writeFileSync(target, encrypted)
    pruneOlderBackups(backupDir, LATEST_BACKUP_FILENAME)
    openDatabase()
    runMigrations(getDb())
    reportProgress(onProgress, 'create', 'writing', 100)
    return { ok: true, filePath: target }
  } catch (error) {
    openDatabase()
    throw error
  } finally {
    backupBusy = false
  }
}

export async function createBackup(
  onProgress?: BackupProgressReporter,
): Promise<{ ok: true; filePath: string }> {
  requirePermission('system:backup_create')
  return createBackupInternal(onProgress)
}

/** Install an encrypted backup. Used by Backup page (auth) and setup restore (no auth). */
export async function installEncryptedBackup(
  filePath: string,
  onProgress?: BackupProgressReporter,
): Promise<void> {
  if (!filePath || !fs.existsSync(filePath)) {
    throw new Error('Backup file not found')
  }
  reportProgress(onProgress, 'restore', 'reading', 2)
  const payload = fs.readFileSync(filePath)
  reportProgress(onProgress, 'restore', 'reading', 6)
  await yieldToEventLoop()

  reportProgress(onProgress, 'restore', 'decrypting', 8)
  const decrypted = decryptBackupPayload(payload)
  reportProgress(onProgress, 'restore', 'decrypting', 18)
  await yieldToEventLoop()

  if (isZipPayload(decrypted)) {
    await restoreFromArchive(decrypted, onProgress)
    return
  }

  // Legacy format: encrypted raw SQLite bytes only (no media).
  if (!isSqlitePayload(decrypted)) {
    throw new Error('Invalid backup file: decrypted data is not a Kaarobar backup')
  }
  reportProgress(onProgress, 'restore', 'installing_db', 25)
  writeDecryptedDb(decrypted)
  reportProgress(onProgress, 'restore', 'finalizing', 85)
  rewriteAbsoluteAssetPathsInDb()
  reportProgress(onProgress, 'restore', 'finalizing', 98)
}

export async function restoreBackup(
  filePath: string,
  onProgress?: BackupProgressReporter,
): Promise<{ ok: true; businessId: string | null }> {
  requirePermission('system:backup_restore')
  if (backupBusy) throw new Error('A backup operation is already in progress')
  backupBusy = true
  try {
    await installEncryptedBackup(filePath, onProgress)
    reportProgress(onProgress, 'restore', 'finalizing', 99)
    const businessId = syncActiveBusinessAfterRestore()
    // Users/session from the previous DB are no longer valid after a full DB replace.
    logout()
    reportProgress(onProgress, 'restore', 'finalizing', 100)
    return { ok: true, businessId }
  } finally {
    backupBusy = false
  }
}

export async function pickBackupFile(): Promise<string | null> {
  const result = await dialog.showOpenDialog({
    title: 'Choose Kaarobar backup',
    properties: ['openFile'],
    filters: [
      { name: 'Kaarobar backup', extensions: ['kaarobar-backup'] },
      { name: 'All files', extensions: ['*'] },
    ],
  })
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
}
