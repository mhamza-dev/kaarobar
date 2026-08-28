import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import Database from 'better-sqlite3'
import { getKaarobarDataDir } from '../config/paths'

let db: Database.Database | null = null
const requireFromHere = createRequire(import.meta.url)

function isLinuxMusl(): boolean {
  if (process.platform !== 'linux') return false
  try {
    const report = process.report?.getReport?.() as { header?: { glibcVersionRuntime?: string } } | undefined
    return !report?.header?.glibcVersionRuntime
  } catch {
    return false
  }
}

function resolveNativeBindingPath(): string | undefined {
  try {
    const packageJsonPath = requireFromHere.resolve('better-sqlite3/package.json')
    const packageDir = path.dirname(packageJsonPath)

    // better-sqlite3 v13+ ships platform prebuilds (used in packaged Electron apps).
    const prebuildTarget = `${isLinuxMusl() ? 'linuxmusl' : process.platform}-${process.arch}`
    const prebuildPath = path.join(packageDir, 'prebuilds', `${prebuildTarget}.node`)
    if (fs.existsSync(prebuildPath)) return prebuildPath

    // Local/dev fallback: node-gyp output from `npm run rebuild:native`.
    const releaseBinding = path.join(packageDir, 'build', 'Release', 'better_sqlite3.node')
    if (fs.existsSync(releaseBinding)) return releaseBinding

    const debugBinding = path.join(packageDir, 'build', 'Debug', 'better_sqlite3.node')
    if (fs.existsSync(debugBinding)) return debugBinding
  } catch {
    // Fallback to better-sqlite3 default resolution if package path lookup fails.
  }
  return undefined
}

export function getDbPath(): string {
  return path.join(getKaarobarDataDir(), 'kaarobar.sqlite')
}

export function dbExists(): boolean {
  return fs.existsSync(getDbPath())
}

export function openDatabase(): Database.Database {
  if (db) return db
  const filePath = getDbPath()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const nativeBinding = resolveNativeBindingPath()
  if (!nativeBinding) {
    throw new Error(
      'better-sqlite3 native build is missing (prebuilds/*.node or build/Release/better_sqlite3.node). Run: npm run rebuild:native',
    )
  }

  db = new Database(filePath, { nativeBinding })
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  return db
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database is not open. Call openDatabase() first.')
  return db
}

export function closeDatabase(): void {
  if (!db) return
  db.close()
  db = null
}

export function isDatabaseOpen(): boolean {
  return db != null
}
