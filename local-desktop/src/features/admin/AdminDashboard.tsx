import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { PageTransition, useToast } from '../../components/ui'
import { AppShell } from '../../components/layout'
import type { NavRouteId } from '../../../shared/auth/permissions'
import type { SessionUser } from '../../../shared/types/api'
import { defaultNavRoute, resolveNavRoute } from '../../lib/nav'
import { normalizeBusinessNature } from '../../lib/businessNature'
import { useLicenseFeatures } from '../../lib/license'
import { useLockStore } from '../../stores/lockStore'
import { LockScreen } from '../auth/LockScreen'
import { useAdminData } from './hooks/useAdminData'
import { DashboardPage } from './pages/DashboardPage'
import { BusinessSettingsPage } from './pages/BusinessSettingsPage'
import { UsersPage } from './pages/UsersPage'
import { ProductsPage } from './pages/ProductsPage'
import { SuppliersPage } from './pages/SuppliersPage'
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage'
import { SupplierDetailPage } from './pages/SupplierDetailPage'
import { PoDetailPage } from './pages/PoDetailPage'
import { PosPage } from './pages/PosPage'
import { TablesPage } from './pages/TablesPage'
import { KitchenDisplayPage } from './pages/KitchenDisplayPage'
import { HappyHourPage } from './pages/HappyHourPage'
import { SalesPage } from './pages/SalesPage'
import { CustomersPage } from './pages/CustomersPage'
import { CustomerDetailPage } from './pages/CustomerDetailPage'
import { SaleDetailPage } from './pages/SaleDetailPage'
import { BackupPage } from './pages/BackupPage'

type Props = {
  user: SessionUser
  onLogout: () => void
  onLicenseLocked?: (lock: {
    mode: 'expired' | 'missing'
    expiresAt: string | null
    issuedTo: string | null
  }) => void
}

export function AdminDashboard({ user, onLogout, onLicenseLocked }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const data = useAdminData(user)
  const businessNature = useMemo(() => {
    const business =
      data.businesses.find((b) => b.id === data.activeBusinessId) ?? data.businesses[0] ?? null
    return normalizeBusinessNature(business?.businessNature)
  }, [data.activeBusinessId, data.businesses])
  const licenseFeatures = useLicenseFeatures()
  const [route, setRoute] = useState<NavRouteId>(() =>
    defaultNavRoute(user, businessNature, licenseFeatures),
  )
  const [customerDetailId, setCustomerDetailId] = useState<string | null>(null)
  const [saleDetailId, setSaleDetailId] = useState<string | null>(null)
  const [supplierDetailId, setSupplierDetailId] = useState<string | null>(null)
  const [poDetailId, setPoDetailId] = useState<string | null>(null)

  useEffect(() => {
    setRoute((current) => resolveNavRoute(user, current, businessNature, licenseFeatures))
  }, [user, businessNature, licenseFeatures])

  useEffect(() => {
    if (!data.error) return
    toast.error(data.error)
    data.setError(null)
  }, [data.error, data.setError, toast])

  const locked = useLockStore((state) => state.locked)

  // Auto-lock after 15 idle minutes; any interaction restarts the countdown.
  useEffect(() => {
    const AUTO_LOCK_MS = 15 * 60_000
    let timer = window.setTimeout(() => useLockStore.getState().lock(), AUTO_LOCK_MS)
    const reset = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(() => useLockStore.getState().lock(), AUTO_LOCK_MS)
    }
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
    for (const eventName of events) {
      window.addEventListener(eventName, reset, { passive: true })
    }
    return () => {
      window.clearTimeout(timer)
      for (const eventName of events) {
        window.removeEventListener(eventName, reset)
      }
    }
  }, [])

  function changeRoute(next: NavRouteId) {
    setCustomerDetailId(null)
    setSaleDetailId(null)
    setSupplierDetailId(null)
    setPoDetailId(null)
    setRoute(resolveNavRoute(user, next, businessNature, licenseFeatures))
  }

  const pageKey = `${route}:${customerDetailId ?? ''}:${saleDetailId ?? ''}:${supplierDetailId ?? ''}:${poDetailId ?? ''}`

  return (
    <>
    {locked ? <LockScreen user={user} onLogout={onLogout} /> : null}
    <AppShell
      user={user}
      route={route}
      businessNature={businessNature}
      onRouteChange={changeRoute}
      onLogout={onLogout}
      onLicenseLocked={onLicenseLocked}
    >
      {data.loading ? (
        <p className="mb-4 text-sm text-ink-muted">{t('common.loading')}</p>
      ) : null}

      <AnimatePresence mode="wait">
        <PageTransition key={pageKey}>
          {route === 'dashboard' ? <DashboardPage user={user} data={data} /> : null}
          {route === 'settings' ? <BusinessSettingsPage user={user} data={data} /> : null}
          {route === 'users' ? <UsersPage user={user} data={data} /> : null}
          {route === 'products' ? <ProductsPage user={user} data={data} /> : null}
          {route === 'tables' ? <TablesPage user={user} data={data} /> : null}
          {route === 'kitchen' ? <KitchenDisplayPage user={user} data={data} /> : null}
          {route === 'happyHour' ? <HappyHourPage user={user} data={data} /> : null}
          {route === 'suppliers' && supplierDetailId ? (
            <SupplierDetailPage
              user={user}
              data={data}
              supplierId={supplierDetailId}
              onBack={() => setSupplierDetailId(null)}
              onOpenPo={(id) => {
                setSupplierDetailId(null)
                setPoDetailId(id)
                setRoute('purchaseOrders')
              }}
            />
          ) : null}
          {route === 'suppliers' && !supplierDetailId ? (
            <SuppliersPage
              user={user}
              data={data}
              onOpenSupplier={(id) => setSupplierDetailId(id)}
            />
          ) : null}
          {route === 'purchaseOrders' && poDetailId ? (
            <PoDetailPage
              user={user}
              data={data}
              poId={poDetailId}
              onBack={() => setPoDetailId(null)}
            />
          ) : null}
          {route === 'purchaseOrders' && !poDetailId ? (
            <PurchaseOrdersPage
              user={user}
              data={data}
              onOpenPo={(id) => setPoDetailId(id)}
            />
          ) : null}
          {route === 'pos' ? (
            <PosPage
              user={user}
              data={data}
              onOpenSale={(id) => {
                setSaleDetailId(id)
                setRoute('sales')
              }}
            />
          ) : null}
          {route === 'sales' && saleDetailId ? (
            <SaleDetailPage
              user={user}
              data={data}
              saleId={saleDetailId}
              onBack={() => setSaleDetailId(null)}
            />
          ) : null}
          {route === 'sales' && !saleDetailId ? (
            <SalesPage
              user={user}
              data={data}
              onOpenSale={(id) => setSaleDetailId(id)}
            />
          ) : null}
          {route === 'customers' && saleDetailId ? (
            <SaleDetailPage
              user={user}
              data={data}
              saleId={saleDetailId}
              onBack={() => setSaleDetailId(null)}
            />
          ) : null}
          {route === 'customers' && customerDetailId && !saleDetailId ? (
            <CustomerDetailPage
              user={user}
              data={data}
              customerId={customerDetailId}
              onBack={() => setCustomerDetailId(null)}
              onOpenSale={(id) => setSaleDetailId(id)}
            />
          ) : null}
          {route === 'customers' && !customerDetailId && !saleDetailId ? (
            <CustomersPage
              user={user}
              data={data}
              onOpenCustomer={(id) => setCustomerDetailId(id)}
            />
          ) : null}
          {route === 'backup' ? (
            <BackupPage user={user} data={data} onRestored={onLogout} />
          ) : null}
        </PageTransition>
      </AnimatePresence>
    </AppShell>
    </>
  )
}
