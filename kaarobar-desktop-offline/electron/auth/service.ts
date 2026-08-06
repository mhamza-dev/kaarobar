import bcrypt from 'bcryptjs'
import { getDb, openDatabase } from '../db/connection'
import { runMigrations } from '../db/migrations'
import { getLicenseStatus, readLocalLicense } from '../licensing/service'
import type {
  LoginPayload,
  LoginResult,
  ResetOwnerPasswordOfflineResult,
  SessionUser,
} from '../../shared/types/api'

let currentSession: SessionUser | null = null

type DbUserRow = {
  id: string
  business_id: string | null
  branch_id: string | null
  name: string
  image_path: string | null
  email: string
  password_hash: string
  role: 'owner' | 'admin' | 'manager' | 'cashier'
  is_active: number
}

export function getSession(): SessionUser | null {
  return currentSession
}

export function logout(): { ok: true } {
  currentSession = null
  return { ok: true }
}

export function login(payload: LoginPayload): LoginResult {
  try {
    openDatabase()
    runMigrations(getDb())
    const user = getDb()
      .prepare(
        `SELECT id, business_id, branch_id, name, image_path, email, password_hash, role, is_active
         FROM users
         WHERE email = ?`,
      )
      .get(payload.email.trim().toLowerCase()) as DbUserRow | undefined

    if (!user) {
      return { ok: false, error: 'invalid_credentials', message: 'Email or password is incorrect.' }
    }

    if (!user.is_active) {
      return { ok: false, error: 'inactive', message: 'This account is inactive.' }
    }

    const passwordOk = bcrypt.compareSync(payload.password, user.password_hash)
    if (!passwordOk) {
      return { ok: false, error: 'invalid_credentials', message: 'Email or password is incorrect.' }
    }

    const session: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      businessId: user.business_id,
      branchId: user.branch_id,
      imagePath: user.image_path,
    }

    getDb()
      .prepare('UPDATE users SET last_login_at = ? WHERE id = ?')
      .run(new Date().toISOString(), user.id)

    currentSession = session
    return { ok: true, user: session }
  } catch (error) {
    return {
      ok: false,
      error: 'unknown',
      message: error instanceof Error ? error.message : 'Login failed',
    }
  }
}

export function resetOwnerPasswordOffline(payload: {
  email: string
  licenseKey: string
  newPassword: string
}): ResetOwnerPasswordOfflineResult {
  const genericFailure: ResetOwnerPasswordOfflineResult = {
    ok: false,
    error: 'invalid_credentials',
    message: 'Could not verify owner account details.',
  }

  try {
    const email = payload.email.trim().toLowerCase()
    const licenseKey = payload.licenseKey.trim()
    const newPassword = payload.newPassword.trim()

    if (!email || !licenseKey || !newPassword) {
      return { ok: false, error: 'validation_failed', message: 'All fields are required.' }
    }
    if (newPassword.length < 8) {
      return {
        ok: false,
        error: 'validation_failed',
        message: 'Password must be at least 8 characters.',
      }
    }

    openDatabase()
    runMigrations(getDb())

    const licenseStatus = getLicenseStatus()
    if (licenseStatus.status === 'none') {
      return {
        ok: false,
        error: 'not_configured',
        message: 'License is not configured on this device.',
      }
    }
    if (licenseStatus.status === 'expired') {
      return {
        ok: false,
        error: 'license_expired',
        message: 'License has expired. Renew license before resetting password.',
      }
    }

    const localLicense = readLocalLicense()
    if (!localLicense || localLicense.licenseKey !== licenseKey) {
      return { ok: false, error: 'invalid_license', message: 'License key is invalid for this device.' }
    }

    const owner = getDb()
      .prepare(
        `SELECT id
         FROM users
         WHERE role = 'owner' AND is_active = 1 AND email = ?`,
      )
      .get(email) as { id: string } | undefined
    if (!owner) return genericFailure

    const passwordHash = bcrypt.hashSync(newPassword, 12)
    getDb().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, owner.id)
    if (currentSession?.id === owner.id) currentSession = null

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: 'unknown',
      message: error instanceof Error ? error.message : 'Password reset failed.',
    }
  }
}
