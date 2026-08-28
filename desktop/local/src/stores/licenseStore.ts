import { create } from 'zustand'
import type { LicenseFeature, LicenseStatusSummary } from '../../shared/types/api'

/**
 * Renderer-side mirror of the installed license. Hydrated once before the
 * dashboard renders (App.tsx) and refreshed by AppShell's 60s license poll and
 * after a new key is activated from Business Settings.
 */
type LicenseState = {
  loaded: boolean
  state: LicenseStatusSummary['state'] | null
  expiresAt: string | null
  issuedTo: string | null
  plan: string | null
  /** null = unrestricted (legacy license issued before plans existed). */
  features: LicenseFeature[] | null
  /** Raw server limits; resolve via resolveLicenseLimits (null = preset). */
  maxUsers: number | null
  maxTemplates: number | null
  setLicense: (summary: LicenseStatusSummary) => void
  clear: () => void
}

export const useLicenseStore = create<LicenseState>((set) => ({
  loaded: false,
  state: null,
  expiresAt: null,
  issuedTo: null,
  plan: null,
  features: null,
  maxUsers: null,
  maxTemplates: null,
  setLicense: (summary) =>
    set({
      loaded: true,
      state: summary.state,
      expiresAt: summary.expiresAt,
      issuedTo: summary.issuedTo,
      plan: summary.plan,
      features: summary.features,
      maxUsers: summary.maxUsers,
      maxTemplates: summary.maxTemplates,
    }),
  clear: () =>
    set({
      loaded: false,
      state: null,
      expiresAt: null,
      issuedTo: null,
      plan: null,
      features: null,
      maxUsers: null,
      maxTemplates: null,
    }),
}))
