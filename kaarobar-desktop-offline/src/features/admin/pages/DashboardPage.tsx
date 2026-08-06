import { useEffect, useMemo, useState } from 'react'
import { Banknote, PackageMinus, TrendingUp, Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, EmptyState, Stagger, useToast } from '../../../components/ui'
import { PageHeader } from '../../../components/layout'
import { useActionVisibility } from '../../../lib/nav'
import { cn } from '../../../lib/cn'
import type {
  AnalyticsRangeDays,
  AnalyticsSummary,
  SessionUser,
} from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'
import { KpiStat } from '../components/dashboard/KpiStat'
import { SalesTrendChart } from '../components/dashboard/SalesTrendChart'
import { TransactionsChart } from '../components/dashboard/TransactionsChart'
import { PaymentMixChart } from '../components/dashboard/PaymentMixChart'
import { TopProductsList } from '../components/dashboard/TopProductsList'
import { useFormatMoney } from '../../../lib/useFormatMoney'

type Props = {
  user: SessionUser
  data: AdminData
}

const RANGE_OPTIONS: AnalyticsRangeDays[] = [7, 30, 90]

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function daysAgoYmd(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - (days - 1))
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function DashboardPage({ user, data }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const { businesses, activeBusinessId, products } = data
  const business = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null
  const hasTrackedStock = products.some((product) => product.tracksStock)
  const [presetDays, setPresetDays] = useState<AnalyticsRangeDays | null>(30)
  const [from, setFrom] = useState(() => daysAgoYmd(30))
  const [to, setTo] = useState(() => todayYmd())
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const query = useMemo(() => {
    if (presetDays) return { days: presetDays as AnalyticsRangeDays }
    return { from, to }
  }, [presetDays, from, to])

  useEffect(() => {
    if (!business || !actions.canViewBusiness) return
    let cancelled = false
    setLoading(true)
    void window.api.analytics
      .summary({ businessId: business.id, ...query })
      .then((result) => {
        if (!cancelled) setSummary(result)
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [actions.canViewBusiness, business, query, t, toast])

  if (!actions.canViewBusiness) return null

  if (!business) {
    return (
      <div>
        <PageHeader
          eyebrow={t('dashboard.overview')}
          title={t('dashboard.welcomeFallback')}
          description={t('dashboard.overviewDesc')}
        />
        <EmptyState title={t('empty.noBusinesses')} description={t('empty.noBusinessesDesc')} />
      </div>
    )
  }

  const currency = business.currency || 'PKR'
  const periodLabel = summary
    ? presetDays === 7
      ? t('dashboard.period7d')
      : presetDays === 30
        ? t('dashboard.period30d')
        : presetDays === 90
          ? t('dashboard.period90d')
          : t('dashboard.periodCustom', { from: summary.from, to: summary.to, days: summary.days })
    : t('dashboard.period30d')

  function applyPreset(option: AnalyticsRangeDays) {
    setPresetDays(option)
    setFrom(daysAgoYmd(option))
    setTo(todayYmd())
  }

  function applyCustomFrom(value: string) {
    setPresetDays(null)
    setFrom(value)
    if (value && to && value > to) setTo(value)
  }

  function applyCustomTo(value: string) {
    setPresetDays(null)
    setTo(value)
    if (value && from && value < from) setFrom(value)
  }

  return (
    <div>
      <div className="mb-4 overflow-hidden rounded-lg border border-brand-primary/15 bg-gradient-to-br from-brand-tint/80 via-surface-raised to-surface-raised p-5 shadow-soft sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">
          {t('dashboard.welcomeEyebrow')}
        </p>
        <h2 className="mt-1 truncate text-2xl font-bold tracking-tight text-ink sm:text-3xl">
          {business.name}
        </h2>
        <p className="mt-1.5 max-w-xl text-sm text-ink-muted">{t('dashboard.welcomeDesc')}</p>
      </div>

      <div
        className="mb-6 flex flex-col gap-3 rounded-lg border border-line/80 bg-surface-raised/90 p-3 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:p-3.5"
        role="group"
        aria-label={t('dashboard.rangeLabel')}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            {t('dashboard.rangeLabel')}
          </p>
          <div className="inline-flex w-full rounded-lg border border-line/90 bg-surface-muted/50 p-0.5 sm:w-auto">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => applyPreset(option)}
                className={cn(
                  'flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors duration-pos sm:flex-none sm:px-3.5 sm:text-sm',
                  presetDays === option
                    ? 'bg-brand-primary text-brand-on-primary shadow-glow'
                    : 'text-ink-muted hover:bg-brand-tint/60 hover:text-brand-primary',
                )}
              >
                {t(
                  option === 7
                    ? 'dashboard.period7d'
                    : option === 90
                      ? 'dashboard.period90d'
                      : 'dashboard.period30d',
                )}
              </button>
            ))}
          </div>
        </div>

        <div
          className={cn(
            'flex items-center gap-2 rounded-lg border bg-surface-muted/40 px-2.5 py-2 sm:shrink-0',
            presetDays === null ? 'border-brand-primary/35 ring-1 ring-brand-primary/15' : 'border-line/80',
          )}
        >
          <label className="sr-only" htmlFor="analytics-from">
            {t('table.dateFrom')}
          </label>
          <input
            id="analytics-from"
            type="date"
            value={from}
            max={to || todayYmd()}
            onChange={(e) => applyCustomFrom(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-1.5 text-sm text-ink outline-none focus:ring-0 sm:w-[9.25rem] sm:flex-none"
          />
          <span className="shrink-0 text-xs font-medium text-ink-subtle" aria-hidden>
            –
          </span>
          <label className="sr-only" htmlFor="analytics-to">
            {t('table.dateTo')}
          </label>
          <input
            id="analytics-to"
            type="date"
            value={to}
            min={from || undefined}
            max={todayYmd()}
            onChange={(e) => applyCustomTo(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-1.5 text-sm text-ink outline-none focus:ring-0 sm:w-[9.25rem] sm:flex-none"
          />
        </div>
      </div>

      {loading && !summary ? (
        <p className="mb-4 text-sm text-ink-muted">{t('common.loading')}</p>
      ) : null}

      {summary ? (
        <>
          <Stagger className="mb-5 grid items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiStat
              label={t('dashboard.kpiSales')}
              value={formatMoney(summary.salesTotal, currency)}
              meta={t('dashboard.kpiSalesCount', { count: summary.salesCount })}
              icon={<TrendingUp className="size-5" aria-hidden />}
              tone="brand"
            />
            <KpiStat
              label={t('dashboard.kpiCredit')}
              value={formatMoney(summary.creditOutstanding, currency)}
              meta={t('dashboard.kpiCreditCustomers', { count: summary.customersWithBalance })}
              icon={<Wallet className="size-5" aria-hidden />}
              tone="warning"
            />
            <KpiStat
              label={t('dashboard.kpiLowStock')}
              value={String(summary.lowStockCount)}
              meta={t('dashboard.kpiLowStockDesc')}
              icon={<PackageMinus className="size-5" aria-hidden />}
              tone={
                !hasTrackedStock
                  ? 'brand'
                  : summary.lowStockCount > 0
                    ? 'danger'
                    : 'success'
              }
            />
            <KpiStat
              label={t('dashboard.kpiPayments')}
              value={formatMoney(
                summary.paymentsByMethod.reduce((sum, row) => sum + row.total, 0),
                currency,
              )}
              meta={t('dashboard.kpiPaymentsForPeriod', { period: periodLabel })}
              icon={<Banknote className="size-5" aria-hidden />}
              tone="success"
            />
          </Stagger>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={t('dashboard.salesTrend')} description={t('dashboard.salesTrendDesc')} interactive>
              <SalesTrendChart points={summary.salesByDay} currency={currency} />
            </Card>
            <Card
              title={t('dashboard.transactions')}
              description={t('dashboard.transactionsDesc')}
              interactive
            >
              <TransactionsChart points={summary.salesByDay} />
            </Card>
            <Card title={t('dashboard.paymentMix')} description={t('dashboard.paymentMixDesc')} interactive>
              <PaymentMixChart rows={summary.paymentsByMethod} currency={currency} />
            </Card>
            <Card title={t('dashboard.topProducts')} description={t('dashboard.topProductsDesc')} interactive>
              <TopProductsList rows={summary.topProducts} currency={currency} />
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}
