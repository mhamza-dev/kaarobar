import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToastProvider } from './components/ui'
import type { BootState } from '../shared/types/api'
import { SetupWizard } from './features/setup/SetupWizard'
import { LicenseGateScreen } from './features/license/LicenseGateScreen'
import { LoginScreen } from './features/auth/LoginScreen'
import { useAuthStore } from './stores/authStore'
import { useActiveBusinessStore } from './stores/activeBusinessStore'
import { AdminDashboard } from './features/admin/AdminDashboard'
import { applyBrandTheme, DEFAULT_BRAND_COLOR, resolveBrandPresetHex } from './lib/theme'

type LicenseLock = {
  mode: 'expired' | 'missing'
  expiresAt: string | null
  issuedTo: string | null
}

export default function App() {
  const { t } = useTranslation()
  const [bootState, setBootState] = useState<BootState | null>(null)
  const [sessionHydrating, setSessionHydrating] = useState(false)
  const [authError, setAuthError] = useState<string | undefined>()
  const [authLoading, setAuthLoading] = useState(false)
  const [licenseLoading, setLicenseLoading] = useState(false)
  const [licenseError, setLicenseError] = useState<string | undefined>()
  const [sessionLicenseLock, setSessionLicenseLock] = useState<LicenseLock | null>(null)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const state = await window.api.app.getBootState()
      if (!cancelled) setBootState(state)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!bootState) return
    // Fresh setup keeps default Kaarobar blue until the Business step picker.
    if (bootState.status === 'needs_setup' || bootState.status === 'error') return
    // After login, useAdminData owns the theme.
    if (user) return

    let cancelled = false
    ;(async () => {
      try {
        const hex = await window.api.app.getBrandColor()
        if (!cancelled) applyBrandTheme(resolveBrandPresetHex(hex))
      } catch {
        if (!cancelled) applyBrandTheme(DEFAULT_BRAND_COLOR)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bootState, user])

  useEffect(() => {
    if (!bootState || bootState.status !== 'needs_login' || user) return
    let cancelled = false
    setSessionHydrating(true)
    ;(async () => {
      try {
        const sessionUser = await window.api.auth.session()
        if (!cancelled && sessionUser) {
          setUser(sessionUser)
        }
      } catch {
        // Keep login screen as fallback.
      } finally {
        if (!cancelled) setSessionHydrating(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bootState, user, setUser])

  async function handleLicenseActivate(licenseKey: string) {
    setLicenseLoading(true)
    setLicenseError(undefined)
    try {
      const result = await window.api.license.activate(licenseKey)
      if (!result.ok) {
        setLicenseError(result.message)
        return
      }
      setSessionLicenseLock(null)
      setBootState(await window.api.app.getBootState())
    } catch (e) {
      setLicenseError(e instanceof Error ? e.message : t('toast.actionFailed'))
    } finally {
      setLicenseLoading(false)
    }
  }

  if (!bootState) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-ink-muted">
        {t('common.checkingState')}
      </div>
    )
  }

  if (bootState.status === 'needs_login' && !user && sessionHydrating) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-ink-muted">
        {t('common.checkingState')}
      </div>
    )
  }

  if (bootState.status === 'needs_setup') {
    return (
      <ToastProvider>
        <SetupWizard onSetupDone={async () => setBootState(await window.api.app.getBootState())} />
      </ToastProvider>
    )
  }

  const bootLicenseLock: LicenseLock | null =
    bootState.status === 'needs_license'
      ? { mode: 'missing', expiresAt: null, issuedTo: null }
      : bootState.status === 'license_expired'
        ? { mode: 'expired', expiresAt: bootState.expiresAt, issuedTo: bootState.issuedTo }
        : null

  const activeLicenseLock = bootLicenseLock ?? sessionLicenseLock

  if (activeLicenseLock) {
    return (
      <ToastProvider>
        <LicenseGateScreen
          mode={activeLicenseLock.mode}
          expiresAt={activeLicenseLock.expiresAt}
          issuedTo={activeLicenseLock.issuedTo}
          loading={licenseLoading}
          error={licenseError}
          onActivate={handleLicenseActivate}
        />
      </ToastProvider>
    )
  }

  if (bootState.status === 'error') {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-sm text-danger">
        {bootState.message}
      </div>
    )
  }

  if (!user) {
    return (
      <LoginScreen
        loading={authLoading}
        error={authError}
        onSubmit={async (values) => {
          setAuthLoading(true)
          setAuthError(undefined)
          const result = await window.api.auth.login(values)
          setAuthLoading(false)
          if (!result.ok) {
            setAuthError(result.message)
            return
          }
          setUser(result.user)
        }}
      />
    )
  }

  return (
    <ToastProvider>
      <AdminDashboard
        user={user}
        onLogout={async () => {
          await window.api.auth.logout()
          useActiveBusinessStore.getState().clear()
          setUser(null)
        }}
        onLicenseLocked={(lock) => setSessionLicenseLock(lock)}
      />
    </ToastProvider>
  )
}
