import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto'

const MAGIC = Buffer.from('KAAROBKB1', 'utf8')
const SALT = 'kaarobar-backup-salt-v1'

/** Stable secret used for committed fixtures and when no env secret is set. */
export const DEV_BACKUP_SECRET = 'kaarobar-dev-backup-secret'

function getBackupSecret(): string {
  return process.env.KAAROBAR_BACKUP_SECRET || process.env.KAAROBAR_LICENSE_SECRET || DEV_BACKUP_SECRET
}

function candidateSecrets(): string[] {
  const secrets = [
    process.env.KAAROBAR_BACKUP_SECRET,
    process.env.KAAROBAR_LICENSE_SECRET,
    DEV_BACKUP_SECRET,
  ].filter((value): value is string => Boolean(value && value.trim()))
  return [...new Set(secrets)]
}

function deriveKey(secret: string): Buffer {
  return scryptSync(secret, SALT, 32)
}

/** Encrypt backup bytes (zip archive or legacy raw SQLite) into a `.kaarobar-backup` payload. */
export function encryptBackupPayload(plainBytes: Buffer): Buffer {
  const key = deriveKey(getBackupSecret())
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plainBytes), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([MAGIC, iv, tag, encrypted])
}

/** Decrypt a `.kaarobar-backup` payload. Throws if magic/header/auth fails. */
export function decryptBackupPayload(payload: Buffer): Buffer {
  if (payload.length < MAGIC.length + 12 + 16 + 1) {
    throw new Error('Invalid backup file: too short')
  }
  const magic = payload.subarray(0, MAGIC.length)
  if (!magic.equals(MAGIC)) {
    throw new Error('Invalid backup file: not a Kaarobar encrypted backup')
  }
  const iv = payload.subarray(MAGIC.length, MAGIC.length + 12)
  const tag = payload.subarray(MAGIC.length + 12, MAGIC.length + 28)
  const data = payload.subarray(MAGIC.length + 28)

  // Try primary + fallbacks so committed fixtures (dev default) and env-encrypted
  // backups both restore when KAAROBAR_LICENSE_SECRET / BACKUP_SECRET differ.
  for (const secret of candidateSecrets()) {
    try {
      const key = deriveKey(secret)
      const decipher = createDecipheriv('aes-256-gcm', key, iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(data), decipher.final()])
    } catch {
      // try next secret
    }
  }
  throw new Error('Invalid backup file: decrypt failed')
}

export function backupContentFingerprint(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex').slice(0, 16)
}
