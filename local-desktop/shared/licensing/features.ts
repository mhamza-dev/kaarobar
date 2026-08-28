import type { NavRouteId } from '../auth/permissions'

/**
 * License plan feature flags.
 *
 * A license carries a `features` list issued by the license server; the app
 * gates whole modules on it (nav, pages, and main-process guards). Licenses
 * issued before plans existed carry no list — `null` — and are treated as
 * unrestricted, so existing customers lose nothing.
 */
export const LICENSE_FEATURES = [
  'pos',
  'sales',
  'products',
  'customers',
  'credit',
  'suppliers',
  'purchase_orders',
  'staff',
  'happy_hour',
] as const

export type LicenseFeature = (typeof LICENSE_FEATURES)[number]

/**
 * Plan presets. The authoritative copy lives in the Supabase `create_license`
 * function (docs/supabase-licensing.sql) — this mirror exists for display and
 * for the dev-mode license. Gating always reads the `features` list, never the
 * plan name, so new plans need no app update.
 */
export const LICENSE_PLAN_FEATURES: Record<string, LicenseFeature[]> = {
  basic: ['pos', 'sales', 'products'],
  standard: ['pos', 'sales', 'products', 'customers', 'staff'],
  advanced: ['pos', 'sales', 'products', 'customers', 'staff', 'credit'],
  pro: ['pos', 'sales', 'products', 'customers', 'staff', 'credit', 'suppliers', 'purchase_orders'],
  full: [
    'pos',
    'sales',
    'products',
    'customers',
    'staff',
    'credit',
    'suppliers',
    'purchase_orders',
    'happy_hour',
  ],
}

/** Display/upgrade order. */
export const LICENSE_PLAN_ORDER = ['basic', 'standard', 'advanced', 'pro', 'full'] as const
export type LicensePlanName = (typeof LICENSE_PLAN_ORDER)[number]

/** Seat/layout limits per plan; mirrored by plan_limits() in the SQL. */
export const LICENSE_PLAN_LIMITS: Record<LicensePlanName, { maxUsers: number; maxTemplates: number }> = {
  basic: { maxUsers: 1, maxTemplates: 2 },
  standard: { maxUsers: 2, maxTemplates: 4 },
  advanced: { maxUsers: 2, maxTemplates: 6 },
  pro: { maxUsers: 3, maxTemplates: 9 },
  full: { maxUsers: 10, maxTemplates: 999 },
}

/**
 * Rank used only to block downgrades. Unknown or missing plan names rank as
 * the highest tier: a legacy license is full access, and a plan the app does
 * not know yet must never be treated as a downgrade.
 */
export function licensePlanRank(plan: string | null | undefined): number {
  const index = (LICENSE_PLAN_ORDER as readonly string[]).indexOf(plan ?? '')
  return index === -1 ? LICENSE_PLAN_ORDER.length - 1 : index
}

/**
 * Effective limits for a license: explicit server-issued values win, then the
 * plan preset, and a legacy license (no plan) is unlimited.
 */
export function resolveLicenseLimits(
  plan: string | null | undefined,
  maxUsers?: number | null,
  maxTemplates?: number | null,
): { maxUsers: number; maxTemplates: number } {
  const preset = plan ? LICENSE_PLAN_LIMITS[plan as LicensePlanName] : undefined
  const users =
    typeof maxUsers === 'number' && Number.isFinite(maxUsers) && maxUsers > 0
      ? maxUsers
      : (preset?.maxUsers ?? Number.POSITIVE_INFINITY)
  const templates =
    typeof maxTemplates === 'number' && Number.isFinite(maxTemplates) && maxTemplates > 0
      ? maxTemplates
      : (preset?.maxTemplates ?? Number.POSITIVE_INFINITY)
  return { maxUsers: users, maxTemplates: templates }
}

/**
 * Coerce a server-provided feature list. `null` = unrestricted (legacy license
 * with no plan). A present-but-empty list stays empty — that is a real plan
 * that includes nothing, not a legacy license.
 */
export function normalizeLicenseFeatures(value: unknown): LicenseFeature[] | null {
  if (!Array.isArray(value)) return null
  const seen = new Set<LicenseFeature>()
  for (const entry of value) {
    if ((LICENSE_FEATURES as readonly string[]).includes(entry as string)) {
      seen.add(entry as LicenseFeature)
    }
  }
  return [...seen]
}

export function hasLicenseFeature(
  features: LicenseFeature[] | null | undefined,
  feature: LicenseFeature,
): boolean {
  if (features == null) return true
  return features.includes(feature)
}

/**
 * Nav routes owned by a gated feature. Routes not listed (dashboard, backup,
 * settings) are core and always available. Tables/kitchen ride with POS; the
 * staff page needs multi-user plans; happy hour is a full-plan perk.
 */
export const NAV_ROUTE_FEATURE: Partial<Record<NavRouteId, LicenseFeature>> = {
  pos: 'pos',
  tables: 'pos',
  kitchen: 'pos',
  sales: 'sales',
  products: 'products',
  happyHour: 'happy_hour',
  customers: 'customers',
  suppliers: 'suppliers',
  purchaseOrders: 'purchase_orders',
  users: 'staff',
}

export function canUseNavRoute(
  features: LicenseFeature[] | null | undefined,
  routeId: NavRouteId,
): boolean {
  const feature = NAV_ROUTE_FEATURE[routeId]
  return feature ? hasLicenseFeature(features, feature) : true
}
