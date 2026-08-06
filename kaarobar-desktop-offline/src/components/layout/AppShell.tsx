import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import {
  Bell,
  ClipboardList,
  ContactRound,
  HardDrive,
  LayoutDashboard,
  Menu,
  LogOut,
  Package,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  UtensilsCrossed,
  WalletCards,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type {
  BusinessNature,
  DailyReminderEvent,
  LicenseStatusSummary,
  SessionUser,
} from '../../../shared/types/api'
import type { NavRouteId } from '../../../shared/auth/permissions'
import { Button } from '../../components/ui'
import { KaarobarLogo } from '../../components/brand'
import { LanguageSelect } from './LanguageSelect'
import { getVisibleNavItems, type NavItem } from '../../lib/nav'
import { cn } from '../../lib/cn'
import { assetSrc } from '../../lib/assets'

const LOCKED_NAV_ROUTES: NavRouteId[] = ['pos', 'sales', 'customers', 'products', 'tables']

type LicenseLockInfo = {
  mode: 'expired' | 'missing'
  expiresAt: string | null
  issuedTo: string | null
}

type Props = {
  user: SessionUser
  route: NavRouteId
  businessNature?: BusinessNature | null
  onRouteChange: (route: NavRouteId) => void
  onLogout: () => void
  onLicenseLocked?: (lock: LicenseLockInfo) => void
  children: ReactNode
}

type RemainingParts = { days: number; hours: number; minutes: number } | null

function getRemainingParts(expiresAt: string | null, nowMs: number): RemainingParts {
  if (!expiresAt) return null
  const target = new Date(expiresAt).getTime()
  if (!Number.isFinite(target)) return null
  const delta = Math.max(0, target - nowMs)
  const totalMinutes = Math.ceil(delta / 60_000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60
  return { days, hours, minutes }
}

const NAV_ICONS: Record<NavRouteId, typeof LayoutDashboard> = {
  dashboard: LayoutDashboard,
  pos: ShoppingCart,
  sales: WalletCards,
  customers: ContactRound,
  products: Package,
  tables: UtensilsCrossed,
  suppliers: Truck,
  purchaseOrders: ClipboardList,
  users: Users,
  backup: HardDrive,
  settings: Settings,
}

type NavListProps = {
  navItems: NavItem[]
  route: NavRouteId
  t: TFunction
  onRouteChange: (route: NavRouteId) => void
  onNavigate?: () => void
  animated?: boolean
}

function NavList({ navItems, route, t, onRouteChange, onNavigate, animated }: NavListProps) {
  return (
    <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label={t('dashboard.mainNav')}>
      {navItems.map((item) => {
        const active = item.id === route
        const Icon = NAV_ICONS[item.id]
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => {
              onRouteChange(item.id)
              onNavigate?.()
            }}
            className={cn(
              'relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-sm font-medium transition-colors duration-pos',
              active ? 'text-brand-primary' : 'text-ink-muted hover:bg-surface-muted/80 hover:text-ink',
            )}
          >
            {active ? (
              animated ? (
                <motion.span
                  layoutId="nav-active-pill"
                  className="absolute inset-0 rounded-lg bg-brand-tint shadow-glow"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              ) : (
                <span className="absolute inset-0 rounded-lg bg-brand-tint shadow-glow" />
              )
            ) : null}
            <Icon className="relative z-10 size-4 shrink-0 opacity-80" aria-hidden />
            <span className="relative z-10">{t(item.labelKey)}</span>
          </button>
        )
      })}
    </nav>
  )
}

type SidebarBodyProps = {
  user: SessionUser
  navItems: NavItem[]
  route: NavRouteId
  t: TFunction
  onRouteChange: (route: NavRouteId) => void
  onLogout: () => void
  onNavigate?: () => void
  animated?: boolean
}

function SidebarBody({
  user,
  navItems,
  route,
  t,
  onRouteChange,
  onLogout,
  onNavigate,
  animated,
}: SidebarBodyProps) {
  const initials = user.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <>
      <div className="border-b border-line/80 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-lg bg-brand-tint shadow-soft">
            <KaarobarLogo className="size-8" mark />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-primary">Kaarobar</p>
            <p className="truncate text-sm font-medium text-ink-muted">{t('dashboard.title')}</p>
          </div>
        </div>
      </div>

      <NavList
        navItems={navItems}
        route={route}
        t={t}
        onRouteChange={onRouteChange}
        onNavigate={onNavigate}
        animated={animated}
      />

      <div className="space-y-3 border-t border-line/80 p-4">
        <div className="flex items-center gap-3 rounded-lg bg-surface-muted/60 p-2.5">
          {user.imagePath ? (
            <img
              src={assetSrc(user.imagePath) ?? undefined}
              alt=""
              className="size-10 shrink-0 rounded-full border border-line object-cover bg-surface-muted"
            />
          ) : (
            <div
              className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand-primary"
              aria-hidden
            >
              {initials || 'K'}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{user.name}</p>
            <p className="truncate text-xs capitalize text-ink-muted">
              {t(`roles.${user.role}`, { defaultValue: user.role })}
            </p>
          </div>
        </div>
        <Button variant="secondary" className="w-full justify-start" onClick={onLogout}>
          <LogOut className="size-4" />
          {t('common.logout')}
        </Button>
      </div>
    </>
  )
}

export function AppShell({
  user,
  route,
  businessNature,
  onRouteChange,
  onLogout,
  onLicenseLocked,
  children,
}: Props) {
  const { t, i18n } = useTranslation()
  const onLicenseLockedRef = useRef(onLicenseLocked)
  onLicenseLockedRef.current = onLicenseLocked
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatusSummary | null>(null)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [reminderEvent, setReminderEvent] = useState<DailyReminderEvent | null>(null)
  const [remindersOpen, setRemindersOpen] = useState(false)
  const licenseLocked = licenseStatus?.state === 'expired' || licenseStatus?.state === 'missing'
  const navItems = getVisibleNavItems(user, businessNature).filter(
    (item) => !(licenseLocked && LOCKED_NAV_ROUTES.includes(item.id)),
  )
  const activeItem = navItems.find((item) => item.id === route)
  const pageTitle = activeItem ? t(activeItem.labelKey) : t('dashboard.title')

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      try {
        const status = await window.api.app.getLicenseStatus()
        if (cancelled) return
        setLicenseStatus(status)
        if (status.state === 'expired' || status.state === 'missing') {
          onLicenseLockedRef.current?.({
            mode: status.state === 'expired' ? 'expired' : 'missing',
            expiresAt: status.expiresAt,
            issuedTo: status.issuedTo,
          })
        }
      } catch {
        if (!cancelled) {
          setLicenseStatus({ state: 'missing', expiresAt: null, issuedTo: null })
          onLicenseLockedRef.current?.({ mode: 'missing', expiresAt: null, issuedTo: null })
        }
      }
    }
    void refresh()
    const timer = window.setInterval(() => {
      setNowMs(Date.now())
      void refresh()
    }, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  useEffect(() => {
    if (!licenseStatus?.expiresAt || licenseStatus.state !== 'valid') return
    const remaining = getRemainingParts(licenseStatus.expiresAt, nowMs)
    if (remaining && remaining.days === 0 && remaining.hours === 0 && remaining.minutes === 0) {
      onLicenseLockedRef.current?.({
        mode: 'expired',
        expiresAt: licenseStatus.expiresAt,
        issuedTo: licenseStatus.issuedTo,
      })
    }
  }, [licenseStatus, nowMs])

  useEffect(() => {
    if (!licenseLocked) return
    if (LOCKED_NAV_ROUTES.includes(route)) {
      onRouteChange('dashboard')
    }
  }, [licenseLocked, route, onRouteChange])

  useEffect(() => {
    const unsubscribe = window.api.app.onDailyReminder((event) => {
      setReminderEvent(event)
      if (event.license?.kind === 'expired' || event.license?.kind === 'missing') {
        onLicenseLockedRef.current?.({
          mode: event.license.kind === 'expired' ? 'expired' : 'missing',
          expiresAt: event.license.expiresAt,
          issuedTo: event.license.issuedTo,
        })
      }
    })
    // Refresh Reminders panel on every authenticated session mount (login / hydrate).
    void window.api.app.maybeRunDailyReminders().catch(() => {
      // Ignore if session not ready yet.
    })
    return unsubscribe
  }, [])

  const reminderItems = useMemo(() => {
    if (!reminderEvent) return [] as Array<{ id: string; text: string; tone: 'warn' | 'info' }>
    const items: Array<{ id: string; text: string; tone: 'warn' | 'info' }> = []
    if (reminderEvent.license?.kind === 'expired') {
      items.push({ id: 'license-expired', text: t('reminders.licenseExpiredDesc'), tone: 'warn' })
    } else if (reminderEvent.license?.kind === 'expiring') {
      items.push({
        id: 'license-expiring',
        text: t('reminders.licenseExpiringTitle', { days: reminderEvent.license.daysLeft ?? 0 }),
        tone: 'warn',
      })
    } else if (reminderEvent.license?.kind === 'missing') {
      items.push({ id: 'license-missing', text: t('reminders.licenseMissingDesc'), tone: 'warn' })
    }
    for (const alert of reminderEvent.restock) {
      items.push({
        id: `restock-${alert.productId}`,
        text: t('reminders.restockItem', {
          name: alert.productName,
          days: alert.daysLeft.toFixed(1),
          qty: alert.stockQty,
        }),
        tone: 'info',
      })
    }
    return items
  }, [reminderEvent, t])

  const licenseChip = useMemo(() => {
    if (!licenseStatus) return null

    if (licenseStatus.state === 'lifetime') {
      return { text: `${t('license.header')}: ${t('license.lifetime')}`, tone: 'ok' as const }
    }

    if (licenseStatus.state === 'expired') {
      return { text: `${t('license.header')}: ${t('license.expired')}`, tone: 'warn' as const }
    }

    if (licenseStatus.state === 'missing') {
      return { text: `${t('license.header')}: ${t('license.notActive')}`, tone: 'warn' as const }
    }

    const parts = getRemainingParts(licenseStatus.expiresAt, nowMs)
    if (!parts) {
      return { text: `${t('license.header')}: ${t('license.notActive')}`, tone: 'warn' as const }
    }

    if (parts.days === 0 && parts.hours === 0 && parts.minutes === 0) {
      return { text: `${t('license.header')}: ${t('license.expired')}`, tone: 'warn' as const }
    }

    const bits: string[] = []
    if (parts.days > 0) bits.push(`${parts.days}${t('license.daysShort')}`)
    if (parts.hours > 0 || parts.days > 0) bits.push(`${parts.hours}${t('license.hoursShort')}`)
    bits.push(`${parts.minutes}${t('license.minutesShort')}`)
    return {
      text: `${t('license.header')}: ${bits.join(' ')} ${t('license.left')}`,
      tone: parts.days <= 7 ? ('warn' as const) : ('ok' as const),
    }
  }, [licenseStatus, nowMs, t])

  return (
    <div className="flex min-h-screen bg-surface">
      <AnimatePresence>
        {mobileNavOpen ? (
          <motion.button
            type="button"
            aria-label={t('common.close')}
            className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 z-auto hidden h-screen w-64 shrink-0 flex-col border-e border-line bg-surface-raised/95 backdrop-blur-md lg:flex">
        <LayoutGroup id="desktop-nav">
          <SidebarBody
            user={user}
            navItems={navItems}
            route={route}
            t={t}
            onRouteChange={onRouteChange}
            onLogout={onLogout}
            animated
          />
        </LayoutGroup>
      </aside>

      {/* Mobile drawer — static pill, no shared layoutId */}
      <AnimatePresence>
        {mobileNavOpen ? (
          <motion.aside
            className="fixed inset-y-0 start-0 z-40 flex h-screen w-72 max-w-[85vw] flex-col border-e border-line bg-surface-raised shadow-lift lg:hidden"
            initial={{ x: i18n.dir() === 'rtl' ? 40 : -40, opacity: 0.85 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: i18n.dir() === 'rtl' ? 40 : -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="absolute end-3 top-3 lg:hidden">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-2"
                aria-label={t('common.close')}
                onClick={() => setMobileNavOpen(false)}
              >
                <X className="size-4" />
              </Button>
            </div>
            <SidebarBody
              user={user}
              navItems={navItems}
              route={route}
              t={t}
              onRouteChange={onRouteChange}
              onLogout={onLogout}
              onNavigate={() => setMobileNavOpen(false)}
            />
          </motion.aside>
        ) : null}
      </AnimatePresence>

      <div className="app-ambient relative flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-line/70 bg-surface-raised/75 backdrop-blur-xl">
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-start gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-0.5 px-2 lg:hidden"
                aria-label={t('dashboard.mainNav')}
                onClick={() => setMobileNavOpen(true)}
              >
                <Menu className="size-4" />
              </Button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {t('common.signedInAs')} {user.name}
                </p>
                <h2 className="truncate text-lg font-bold tracking-tight text-ink sm:text-xl">{pageTitle}</h2>
              </div>
            </div>

            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
              <div className="relative">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-10 gap-1.5"
                  aria-expanded={remindersOpen}
                  aria-label={t('reminders.title')}
                  onClick={() => setRemindersOpen((open) => !open)}
                >
                  <Bell className="size-4" />
                  {t('reminders.title')}
                  {reminderItems.length > 0 ? (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-lg bg-warning-soft px-1.5 text-[11px] font-bold text-warning">
                      {reminderItems.length}
                    </span>
                  ) : null}
                </Button>
                {remindersOpen ? (
                  <div className="absolute end-0 z-30 mt-2 w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface-raised p-3 shadow-lift">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-ink">{t('reminders.title')}</p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="px-2"
                        aria-label={t('common.close')}
                        onClick={() => setRemindersOpen(false)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                    {reminderItems.length === 0 ? (
                      <p className="text-sm text-ink-muted">{t('reminders.empty')}</p>
                    ) : (
                      <ul className="max-h-64 space-y-2 overflow-y-auto">
                        {reminderItems.map((item) => (
                          <li
                            key={item.id}
                            className={cn(
                              'rounded-lg border px-3 py-2 text-xs leading-relaxed',
                              item.tone === 'warn'
                                ? 'border-warning/30 bg-warning-soft/50 text-warning'
                                : 'border-line bg-surface-muted/70 text-ink',
                            )}
                          >
                            {item.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
              {licenseChip ? (
                <span
                  className={cn(
                    'inline-flex h-10 items-center rounded-lg border px-3 text-xs font-semibold',
                    licenseChip.tone === 'warn'
                      ? 'border-warning/35 bg-warning-soft/60 text-warning'
                      : 'border-success/35 bg-success-soft/60 text-success',
                  )}
                >
                  {licenseChip.text}
                </span>
              ) : null}
              <LanguageSelect />
            </div>
          </div>
        </header>

        <main className="relative flex-1 p-[var(--space-page)]">{children}</main>
      </div>
    </div>
  )
}

