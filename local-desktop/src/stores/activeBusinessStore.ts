import { create } from 'zustand'

type ActiveBusinessState = {
  businessId: string | null
  branchId: string | null
  /** ISO currency code from the active business (Business Settings). */
  currency: string | null
  setActiveBusiness: (businessId: string | null, currency?: string | null) => void
  setActiveBranch: (branchId: string | null) => void
  setCurrency: (currency: string | null) => void
  clear: () => void
}

export const useActiveBusinessStore = create<ActiveBusinessState>((set) => ({
  businessId: null,
  branchId: null,
  currency: null,
  setActiveBusiness: (businessId, currency) =>
    set((state) => ({
      businessId,
      currency: currency !== undefined ? currency?.trim().toUpperCase() || null : state.currency,
    })),
  setActiveBranch: (branchId) => set({ branchId }),
  setCurrency: (currency) => set({ currency: currency?.trim().toUpperCase() || null }),
  clear: () => set({ businessId: null, branchId: null, currency: null }),
}))
