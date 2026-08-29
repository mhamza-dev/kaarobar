import type { SessionUser } from '../types/api'

export type PermissionAction =
  | 'business:edit'
  | 'branch:edit'
  | 'business:view'
  | 'users:manage'
  | 'products:edit'
  | 'products:view'
  | 'suppliers:edit'
  | 'purchaseOrders:edit'
  | 'customers:edit'
  | 'sales:checkout'
  | 'sales:refund_request'
  | 'sales:refund_approve'
  | 'sales:delete'
  | 'sales:print'
  | 'tables:edit'
  | 'system:backup_create'
  | 'system:backup_restore'

export type NavRouteId =
  | 'dashboard'
  | 'pos'
  | 'sales'
  | 'customers'
  | 'products'
  | 'tables'
  | 'kitchen'
  | 'happyHour'
  | 'suppliers'
  | 'purchaseOrders'
  | 'users'
  | 'backup'
  | 'settings'

/** Display order for the main navbar (sell → catalog → vendors → admin). */
export const NAV_ROUTE_ORDER: NavRouteId[] = [
  'dashboard',
  'pos',
  'kitchen',
  'sales',
  'customers',
  'products',
  'happyHour',
  'tables',
  'suppliers',
  'purchaseOrders',
  'users',
  'backup',
  'settings',
]

/**
 * Role matrix (v1):
 * - Owner/Admin: full access (admin includes business settings for the shop)
 * - Manager: everything except Business settings, Users, and Restore Backup
 * - Cashier: POS, Sales, Create Refund, Customers, Create Backup, Create PO
 */
const ROLE_PERMISSIONS: Record<SessionUser['role'], PermissionAction[]> = {
  owner: [
    'business:edit',
    'branch:edit',
    'business:view',
    'users:manage',
    'products:edit',
    'products:view',
    'suppliers:edit',
    'purchaseOrders:edit',
    'customers:edit',
    'sales:checkout',
    'sales:refund_request',
    'sales:refund_approve',
    // Owner only, deliberately. Deleting a sale reverses stock, credit and the
    // day's takings at once; a manager who can undo a shortfall without anyone
    // else's sign-off is the gap every till fraud goes through.
    'sales:delete',
    'sales:print',
    'tables:edit',
    'system:backup_create',
    'system:backup_restore',
  ],
  admin: [
    'business:edit',
    'branch:edit',
    'business:view',
    'users:manage',
    'products:edit',
    'products:view',
    'suppliers:edit',
    'purchaseOrders:edit',
    'customers:edit',
    'sales:checkout',
    'sales:refund_request',
    'sales:refund_approve',
    'sales:print',
    'tables:edit',
    'system:backup_create',
    'system:backup_restore',
  ],
  manager: [
    'business:view',
    'products:edit',
    'products:view',
    'suppliers:edit',
    'purchaseOrders:edit',
    'customers:edit',
    'sales:checkout',
    'sales:refund_request',
    'sales:refund_approve',
    'sales:print',
    'tables:edit',
    'system:backup_create',
  ],
  cashier: [
    'purchaseOrders:edit',
    'customers:edit',
    'sales:checkout',
    'sales:refund_request',
    'sales:print',
    'system:backup_create',
  ],
}

/** Permission required to see a navbar route. `null` = any authenticated user. */
export const NAV_ROUTE_PERMISSION: Record<NavRouteId, PermissionAction | null> = {
  dashboard: 'business:view',
  pos: 'sales:checkout',
  kitchen: 'sales:checkout',
  sales: null,
  customers: 'customers:edit',
  products: 'products:view',
  happyHour: 'products:view',
  tables: 'tables:edit',
  suppliers: 'suppliers:edit',
  purchaseOrders: 'purchaseOrders:edit',
  users: 'users:manage',
  backup: 'system:backup_create',
  // Business settings — Admin/Owner only (managers excluded)
  settings: 'business:edit',
}

export function can(user: SessionUser | null, action: PermissionAction): boolean {
  if (!user) return false
  return ROLE_PERMISSIONS[user.role].includes(action)
}

export function canAccessRoute(user: SessionUser | null, routeId: NavRouteId): boolean {
  if (!user) return false
  const required = NAV_ROUTE_PERMISSION[routeId]
  if (!required) return true
  return can(user, required)
}

export function visibleNavRoutes(user: SessionUser | null): NavRouteId[] {
  return NAV_ROUTE_ORDER.filter((id) => canAccessRoute(user, id))
}

export function permissionsFor(user: SessionUser | null): PermissionAction[] {
  if (!user) return []
  return [...ROLE_PERMISSIONS[user.role]]
}
