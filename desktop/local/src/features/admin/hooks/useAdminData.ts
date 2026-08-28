import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  Branch,
  Business,
  Customer,
  Product,
  PurchaseOrder,
  Sale,
  SessionUser,
  StaffUser,
  Supplier,
} from '../../../../shared/types/api'
import { can } from '../../../../shared/auth/permissions'
import { useActiveBusinessStore } from '../../../stores/activeBusinessStore'
import { applyBrandTheme, DEFAULT_BRAND_COLOR, resolveBrandPresetHex } from '../../../lib/theme'

export function useAdminData(user: SessionUser) {
  const canManageUsers = can(user, 'users:manage')
  const canCheckout = can(user, 'sales:checkout')
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [staff, setStaff] = useState<StaffUser[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const activeBusinessId = useActiveBusinessStore((s) => s.businessId)
  const setActiveBusiness = useActiveBusinessStore((s) => s.setActiveBusiness)

  const branchOptions = useMemo(
    () => branches.map((branch) => ({ value: branch.id, label: branch.name })),
    [branches],
  )
  const supplierOptions = useMemo(
    () => suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name })),
    [suppliers],
  )
  const customerOptions = useMemo(
    () => customers.map((customer) => ({ value: customer.id, label: customer.name })),
    [customers],
  )

  const refreshBusinesses = useCallback(async () => {
    const data = await window.api.business.list()
    setBusinesses(data)
    const selected = activeBusinessId
      ? data.find((business) => business.id === activeBusinessId)
      : undefined
    // After restore (or any DB replace), Zustand may still hold a pre-restore business id.
    // Dashboard falls back to businesses[0] for analytics; lists must use the same id.
    if (!selected && data[0]) {
      setActiveBusiness(data[0].id, data[0].currency)
      await window.api.business.setActive(data[0].id)
      applyBrandTheme(resolveBrandPresetHex(data[0].brandColor))
      return
    }
    if (selected) {
      useActiveBusinessStore.getState().setCurrency(selected.currency)
      applyBrandTheme(resolveBrandPresetHex(selected.brandColor))
    }
  }, [activeBusinessId, setActiveBusiness])

  const refreshScopedData = useCallback(
    async (businessId: string) => {
      const [branchData, productData, supplierData, poData, customerData, salesData] =
        await Promise.all([
          window.api.business.branches(businessId),
          window.api.products.list(businessId),
          window.api.suppliers.list(businessId),
          window.api.purchaseOrders.list(businessId),
          window.api.customers.list(businessId),
          window.api.sales.list(businessId),
        ])
      const staffData =
        canManageUsers || canCheckout ? await window.api.users.list(businessId) : []
      setBranches(branchData)
      setStaff(staffData)
      setProducts(productData)
      setSuppliers(supplierData)
      setPurchaseOrders(poData)
      setCustomers(customerData)
      setSales(salesData)
    },
    [canCheckout, canManageUsers],
  )

  const refreshAll = useCallback(async () => {
    setLoading(true)
    try {
      await refreshBusinesses()
      const businessId = useActiveBusinessStore.getState().businessId
      if (businessId) await refreshScopedData(businessId)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [refreshBusinesses, refreshScopedData])

  useEffect(() => {
    refreshBusinesses().catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
  }, [refreshBusinesses])

  useEffect(() => {
    if (!activeBusinessId) return
    if (!businesses.some((business) => business.id === activeBusinessId)) return
    const selected = businesses.find((business) => business.id === activeBusinessId)
    if (selected) {
      useActiveBusinessStore.getState().setCurrency(selected.currency)
    }
    applyBrandTheme(resolveBrandPresetHex(selected?.brandColor ?? DEFAULT_BRAND_COLOR))
    setLoading(true)
    refreshScopedData(activeBusinessId)
      .catch((e) => setError(e instanceof Error ? e.message : 'Load failed'))
      .finally(() => setLoading(false))
  }, [activeBusinessId, businesses, refreshScopedData])

  return {
    businesses,
    branches,
    staff,
    products,
    suppliers,
    purchaseOrders,
    customers,
    sales,
    error,
    setError,
    loading,
    activeBusinessId,
    setActiveBusiness,
    branchOptions,
    supplierOptions,
    customerOptions,
    refreshBusinesses,
    refreshScopedData,
    refreshAll,
  }
}

export type AdminData = ReturnType<typeof useAdminData>
