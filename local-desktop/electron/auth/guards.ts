import { getSession } from './service'
import { can, type PermissionAction } from '../../shared/auth/permissions'
import { getDb } from '../db/connection'
import { getLicenseFeatures, getLicenseStatus } from '../licensing/service'
import { hasLicenseFeature, type LicenseFeature } from '../../shared/licensing/features'

export function requireSession() {
  const session = getSession()
  if (!session) throw new Error('Not authenticated')
  return session
}

/** Blocks POS / products / sales when the local license is missing or expired. Lifetime (null expiresAt) always passes. */
export function requireValidLicense(): void {
  const status = getLicenseStatus()
  if (status.status === 'valid') return
  throw new Error('License expired')
}

/** True when the installed license plan includes the feature (legacy licenses include everything). */
export function isFeatureEnabled(feature: LicenseFeature): boolean {
  return hasLicenseFeature(getLicenseFeatures(), feature)
}

/** Blocks module actions the license plan does not include. */
export function requireFeature(feature: LicenseFeature): void {
  if (!isFeatureEnabled(feature)) {
    throw new Error('This feature is not included in your license plan. Upgrade your license to use it.')
  }
}

export function requirePermission(action: PermissionAction) {
  const session = requireSession()
  if (!can(session, action)) throw new Error('Forbidden')
  return session
}

export function assertBusinessAccess(businessId: string): void {
  const session = requireSession()
  if (session.role === 'owner') return
  if (session.businessId !== businessId) throw new Error('Forbidden business scope')
}

export function assertBranchAccess(branchId: string): void {
  const session = requireSession()
  if (session.role === 'owner' || session.role === 'admin') return
  if (session.branchId !== branchId) throw new Error('Forbidden branch scope')
}

export function refreshSessionBusinessAndBranch(): void {
  const session = getSession()
  if (!session || session.role === 'owner') return
  const branch = getDb()
    .prepare('SELECT business_id FROM branches WHERE id = ?')
    .get(session.branchId ?? '') as { business_id: string } | undefined
  if (session.branchId && !branch) throw new Error('Session branch not found')
  if (branch && branch.business_id !== session.businessId) throw new Error('Session scope mismatch')
}
