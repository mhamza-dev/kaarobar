import type { SessionUser, BusinessNature } from '../../shared/types/api'
import type { NavRouteId } from '../../shared/auth/permissions'
import { can, canAccessRoute, visibleNavRoutes } from '../../shared/auth/permissions'
import { showsTables } from './businessNature'

export type NavItem = {
  id: NavRouteId
  labelKey: string
}

const NAV_LABEL_KEYS: Record<NavRouteId, string> = {
  dashboard: 'dashboard.overview',
  pos: 'dashboard.pos',
  sales: 'dashboard.sales',
  customers: 'dashboard.customers',
  products: 'dashboard.products',
  tables: 'dashboard.tables',
  suppliers: 'dashboard.suppliers',
  purchaseOrders: 'dashboard.purchaseOrders',
  users: 'dashboard.users',
  backup: 'dashboard.backup',
  settings: 'dashboard.businessSettings',
}

export function getVisibleNavItems(
  user: SessionUser | null,
  businessNature?: BusinessNature | null,
): NavItem[] {
  const nature = businessNature ?? 'retail'
  return visibleNavRoutes(user)
    .filter((id) => (id === 'tables' ? showsTables(nature) : true))
    .map((id) => ({
      id,
      labelKey: NAV_LABEL_KEYS[id],
    }))
}

export function defaultNavRoute(
  user: SessionUser | null,
  businessNature?: BusinessNature | null,
): NavRouteId {
  const routes = getVisibleNavItems(user, businessNature).map((item) => item.id)
  if (routes.includes('pos') && user?.role === 'cashier') return 'pos'
  return routes[0] ?? 'pos'
}

export function resolveNavRoute(
  user: SessionUser | null,
  requested: string,
  businessNature?: BusinessNature | null,
): NavRouteId {
  const nature = businessNature ?? 'retail'
  if (requested === 'tables' && !showsTables(nature)) return defaultNavRoute(user, nature)
  if (canAccessRoute(user, requested as NavRouteId)) {
    if (requested === 'tables' && !showsTables(nature)) return defaultNavRoute(user, nature)
    return requested as NavRouteId
  }
  return defaultNavRoute(user, nature)
}

export function useActionVisibility(user: SessionUser | null) {
  return {
    canViewBusiness: can(user, 'business:view'),
    canEditBusiness: can(user, 'business:edit'),
    canEditBranch: can(user, 'branch:edit'),
    canManageUsers: can(user, 'users:manage'),
    canViewProducts: can(user, 'products:view'),
    canEditProducts: can(user, 'products:edit'),
    canEditSuppliers: can(user, 'suppliers:edit'),
    canEditPurchaseOrders: can(user, 'purchaseOrders:edit'),
    canEditCustomers: can(user, 'customers:edit'),
    canCheckout: can(user, 'sales:checkout'),
    canRequestRefund: can(user, 'sales:refund_request'),
    canApproveRefund: can(user, 'sales:refund_approve'),
    canPrint: can(user, 'sales:print'),
    canEditTables: can(user, 'tables:edit'),
    canBackupCreate: can(user, 'system:backup_create'),
    canBackupRestore: can(user, 'system:backup_restore'),
  }
}
