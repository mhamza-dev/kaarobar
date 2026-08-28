import {
  createHash,
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  randomUUID,
} from 'node:crypto'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import type { LocalLicenseRecord } from '../config/store'

const APP_SECRET = process.env.KAAROBAR_LICENSE_SECRET ?? ''
const LICENSE_SALT = 'kaarobar-license-salt'

let cachedStableFingerprint: string | null = null
let cachedLegacyFingerprint: string | null = null

/** Pre-stable algorithm (hostname + user + NIC MACs). Kept only for license migration. */
export function getLegacyDeviceFingerprint(): string {
  if (cachedLegacyFingerprint) return cachedLegacyFingerprint

  let macs = ''
  try {
    const nets = os.networkInterfaces()
    macs = Object.values(nets)
      .flatMap((entries) => entries ?? [])
      .filter((entry) => entry && !entry.internal && entry.mac && entry.mac !== '00:00:00:00:00:00')
      .map((entry) => entry.mac)
      .sort()
      .join('|')
  } catch {
    macs = ''
  }

  const seed = [
    'kaarobar',
    os.hostname(),
    os.platform(),
    os.arch(),
    os.userInfo().username,
    macs,
  ].join('::')

  cachedLegacyFingerprint = createHash('sha256').update(seed).digest('hex')
  return cachedLegacyFingerprint
}

function hashStableId(stableId: string): string {
  return createHash('sha256').update(`kaarobar::${stableId}`).digest('hex')
}

function readMacPlatformUuid(): string | null {
  try {
    const out = execFileSync('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice'], {
      encoding: 'utf8',
      timeout: 5000,
      windowsHide: true,
    })
    const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/)
    const id = match?.[1]?.trim()
    return id || null
  } catch {
    return null
  }
}

function readWindowsMachineGuid(): string | null {
  try {
    const out = execFileSync(
      'reg',
      ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
      { encoding: 'utf8', timeout: 5000, windowsHide: true },
    )
    const match = out.match(/MachineGuid\s+REG_SZ\s+([0-9A-Fa-f-]+)/)
    const id = match?.[1]?.trim()
    return id || null
  } catch {
    return null
  }
}

function readLinuxMachineId(): string | null {
  for (const file of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
    try {
      const id = fs.readFileSync(file, 'utf8').trim()
      if (id) return id
    } catch {
      // try next
    }
  }
  return null
}

function readOsMachineId(): string | null {
  switch (os.platform()) {
    case 'darwin':
      return readMacPlatformUuid()
    case 'win32':
      return readWindowsMachineGuid()
    default:
      return readLinuxMachineId()
  }
}

/** Durable path outside wipeable `{appData}/Kaarobar` so reinstalls keep the same device id. */
export function getDurableDeviceIdPath(): string {
  const home = os.homedir()
  switch (os.platform()) {
    case 'darwin':
      return path.join(home, 'Library', 'Application Support', '2ndHub', 'Kaarobar', 'device.id')
    case 'win32': {
      const programData = process.env.PROGRAMDATA || 'C:\\ProgramData'
      return path.join(programData, '2ndHub', 'Kaarobar', 'device.id')
    }
    default:
      return path.join(home, '.local', 'share', '2ndHub', 'Kaarobar', 'device.id')
  }
}

function readDurableDeviceId(): string | null {
  try {
    const id = fs.readFileSync(getDurableDeviceIdPath(), 'utf8').trim()
    return id || null
  } catch {
    return null
  }
}

function writeDurableDeviceId(id: string): void {
  const filePath = getDurableDeviceIdPath()
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, id, { encoding: 'utf8', mode: 0o600 })
}

function resolveStableDeviceId(): string {
  const fromOs = readOsMachineId()
  if (fromOs) return fromOs

  const existing = readDurableDeviceId()
  if (existing) return existing

  const created = randomUUID()
  try {
    writeDurableDeviceId(created)
    return created
  } catch {
    // ProgramData may be unwritable; fall back to user-local durable path on Windows.
    if (os.platform() === 'win32') {
      const fallback = path.join(
        process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
        '2ndHub',
        'Kaarobar',
        'device.id',
      )
      try {
        const existingLocal = fs.readFileSync(fallback, 'utf8').trim()
        if (existingLocal) return existingLocal
        fs.mkdirSync(path.dirname(fallback), { recursive: true })
        fs.writeFileSync(fallback, created, { encoding: 'utf8', mode: 0o600 })
        return created
      } catch {
        return created
      }
    }
    return created
  }
}

/**
 * Stable device fingerprint for licensing.
 * Prefers OS machine UUID; otherwise a durable device.id outside the Kaarobar app data dir.
 */
export function getDeviceFingerprint(): string {
  if (cachedStableFingerprint) return cachedStableFingerprint
  cachedStableFingerprint = hashStableId(resolveStableDeviceId())
  return cachedStableFingerprint
}

/** @internal test helper */
export function clearDeviceFingerprintCache(): void {
  cachedStableFingerprint = null
  cachedLegacyFingerprint = null
}

/**
 * scrypt is deliberately expensive (~50-100ms) and the license is re-read by
 * nearly every guarded IPC call, so memoize the derived key per fingerprint —
 * the inputs (secret, fingerprint, salt) never change within a process.
 */
const derivedKeyCache = new Map<string, Buffer>()

function deriveKey(fingerprint: string): Buffer {
  const cached = derivedKeyCache.get(fingerprint)
  if (cached) return cached
  const key = scryptSync(`${APP_SECRET}:${fingerprint}`, LICENSE_SALT, 32)
  derivedKeyCache.set(fingerprint, key)
  return key
}

export function encryptLicenseRecord(record: LocalLicenseRecord): string {
  const key = deriveKey(record.fingerprint)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const plaintext = Buffer.from(JSON.stringify(record), 'utf8')
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()

  return Buffer.concat([iv, tag, encrypted]).toString('base64')
}

export function decryptLicenseRecord(blob: string, expectedFingerprint: string): LocalLicenseRecord | null {
  try {
    const payload = Buffer.from(blob, 'base64')
    const iv = payload.subarray(0, 12)
    const tag = payload.subarray(12, 28)
    const data = payload.subarray(28)

    const key = deriveKey(expectedFingerprint)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8')
    const record = JSON.parse(decrypted) as LocalLicenseRecord
    return record.fingerprint === expectedFingerprint ? record : null
  } catch {
    return null
  }
}

/**
 * Decrypt with stable fingerprint, then legacy. When only legacy works, returns a record
 * already rewritten to the stable fingerprint (caller should persist + rebind server).
 */
export function decryptLicenseRecordFlexible(blob: string): {
  record: LocalLicenseRecord
  migratedFromLegacy: boolean
} | null {
  const stable = getDeviceFingerprint()
  const withStable = decryptLicenseRecord(blob, stable)
  if (withStable) return { record: withStable, migratedFromLegacy: false }

  const legacy = getLegacyDeviceFingerprint()
  if (legacy === stable) return null

  const withLegacy = decryptLicenseRecord(blob, legacy)
  if (!withLegacy) return null

  return {
    record: {
      ...withLegacy,
      fingerprint: stable,
    },
    migratedFromLegacy: true,
  }
}

export function isLicenseExpired(record: LocalLicenseRecord, now = new Date()): boolean {
  if (!record.expiresAt) return false
  return new Date(record.expiresAt).getTime() < now.getTime()
}
