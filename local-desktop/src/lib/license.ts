/**
 * Renderer shim over the shared license-feature helpers (mirrors
 * src/lib/businessNature.ts) plus the reactive feature hook.
 */
import { useLicenseStore } from '../stores/licenseStore'
import { resolveLicenseLimits as resolveLimits } from '../../shared/licensing/features'
import type { LicenseFeature } from '../../shared/licensing/features'

export {
  LICENSE_FEATURES,
  LICENSE_PLAN_FEATURES,
  LICENSE_PLAN_LIMITS,
  LICENSE_PLAN_ORDER,
  canUseNavRoute,
  hasLicenseFeature,
  licensePlanRank,
  normalizeLicenseFeatures,
  resolveLicenseLimits,
} from '../../shared/licensing/features'
export type { LicenseFeature, LicensePlanName } from '../../shared/licensing/features'

/** Reactive feature list of the installed license; null = unrestricted. */
export function useLicenseFeatures(): LicenseFeature[] | null {
  return useLicenseStore((state) => state.features)
}

/** Reactive effective seat/receipt-layout limits (Infinity = unlimited). */
export function useLicenseLimits(): { maxUsers: number; maxTemplates: number } {
  const plan = useLicenseStore((state) => state.plan)
  const maxUsers = useLicenseStore((state) => state.maxUsers)
  const maxTemplates = useLicenseStore((state) => state.maxTemplates)
  return resolveLimits(plan, maxUsers, maxTemplates)
}
