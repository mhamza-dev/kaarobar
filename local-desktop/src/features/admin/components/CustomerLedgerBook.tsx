import { useMemo, useState } from 'react'
import { Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, EmptyState, useToast } from '../../../components/ui'
import { cn } from '../../../lib/cn'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import { useFormatDate } from '../../../lib/useFormatDate'
import { paymentMethodI18nKey } from '../../../lib/paymentMethodI18n'
import type { CustomerSaleSummary, LedgerEntry } from '../../../../shared/types/api'

type Props = {
  customerId: string
  ledger: LedgerEntry[]
  sales: CustomerSaleSummary[]
  canPrint: boolean
}

function todayYmd(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function entryDateYmd(iso: string): string {
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return iso.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function displayLedgerNote(entry: LedgerEntry): string {
  if (!entry.note) return ''
  const match = entry.note.match(/^method:(cash|card)(?:\s*\|\s*(.*))?$/i)
  if (match) return match[2]?.trim() || ''
  return entry.note.trim()
}

export function CustomerLedgerBook({ customerId, ledger, sales, canPrint }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const formatMoney = useFormatMoney()
  const { formatDateTime } = useFormatDate()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [printing, setPrinting] = useState(false)

  const invoiceBySaleId = useMemo(
    () => new Map(sales.map((sale) => [sale.id, sale.invoiceNo] as const)),
    [sales],
  )

  const sortedAsc = useMemo(
    () =>
      [...ledger].sort((a, b) => {
        const byDate = a.createdAt.localeCompare(b.createdAt)
        return byDate !== 0 ? byDate : a.id.localeCompare(b.id)
      }),
    [ledger],
  )

  const { rows, openingBalance, debitTotal, creditTotal, closingBalance, hasRange } = useMemo(() => {
    const rangeActive = Boolean(from || to)
    const filtered = sortedAsc.filter((entry) => {
      const ymd = entryDateYmd(entry.createdAt)
      if (from && ymd < from) return false
      if (to && ymd > to) return false
      return true
    })

    let opening = 0
    if (from) {
      const before = sortedAsc.filter((entry) => entryDateYmd(entry.createdAt) < from)
      if (before.length > 0) opening = before[before.length - 1].balanceAfter
    }

    let debit = 0
    let credit = 0
    for (const entry of filtered) {
      if (entry.amount > 0) debit += entry.amount
      else if (entry.amount < 0) credit += Math.abs(entry.amount)
    }

    const closing =
      filtered.length > 0 ? filtered[filtered.length - 1].balanceAfter : opening

    return {
      rows: filtered,
      openingBalance: opening,
      debitTotal: debit,
      creditTotal: credit,
      closingBalance: closing,
      hasRange: rangeActive,
    }
  }, [from, to, sortedAsc])

  function particulars(entry: LedgerEntry): string {
    const parts = [t(`statuses.ledger.${entry.type}`, { defaultValue: entry.type })]
    if (entry.referenceSaleId) {
      const invoice = invoiceBySaleId.get(entry.referenceSaleId)
      if (invoice) parts.push(invoice)
    }
    if (entry.method) {
      parts.push(t(paymentMethodI18nKey(entry.method), { defaultValue: entry.method }))
    }
    const note = displayLedgerNote(entry)
    if (note) parts.push(note)
    return parts.join(' · ')
  }

  async function onPrint() {
    setPrinting(true)
    try {
      await window.api.customers.printLedger({
        customerId,
        from: from || null,
        to: to || null,
      })
      toast.success(t('toast.ledgerPrinted'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    } finally {
      setPrinting(false)
    }
  }

  if (ledger.length === 0) {
    return <EmptyState title={t('empty.noLedger')} description={t('empty.noLedgerDesc')} />
  }

  const showOpening = hasRange || openingBalance !== 0

  return (
    <div className="space-y-4">
      <div
        className="flex flex-col gap-3 rounded-lg border border-line/80 bg-surface-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        role="group"
        aria-label={t('table.dateRange')}
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <p className="shrink-0 text-xs font-semibold uppercase tracking-[0.12em] text-ink-subtle">
            {t('table.dateRange')}
          </p>
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border bg-surface-raised/80 px-2.5 py-2',
              from || to ? 'border-brand-primary/35 ring-1 ring-brand-primary/15' : 'border-line/80',
            )}
          >
            <label className="sr-only" htmlFor="ledger-from">
              {t('table.dateFrom')}
            </label>
            <input
              id="ledger-from"
              type="date"
              value={from}
              max={to || todayYmd()}
              onChange={(e) => {
                const value = e.target.value
                setFrom(value)
                if (value && to && value > to) setTo(value)
              }}
              className="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-1.5 text-sm text-ink outline-none focus:ring-0 sm:w-[9.25rem] sm:flex-none"
            />
            <span className="shrink-0 text-xs font-medium text-ink-subtle" aria-hidden>
              –
            </span>
            <label className="sr-only" htmlFor="ledger-to">
              {t('table.dateTo')}
            </label>
            <input
              id="ledger-to"
              type="date"
              value={to}
              min={from || undefined}
              max={todayYmd()}
              onChange={(e) => {
                const value = e.target.value
                setTo(value)
                if (value && from && value < from) setFrom(value)
              }}
              className="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-1.5 text-sm text-ink outline-none focus:ring-0 sm:w-[9.25rem] sm:flex-none"
            />
          </div>
          {from || to ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFrom('')
                setTo('')
              }}
            >
              {t('common.clear')}
            </Button>
          ) : null}
        </div>

        {canPrint ? (
          <Button type="button" variant="secondary" loading={printing} onClick={() => void onPrint()}>
            <Printer className="size-4" />
            {t('forms.printLedger')}
          </Button>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-lg border border-ink/20 bg-[#fbfaf6] shadow-inner">
        <div className="border-b border-ink/15 bg-[#f3efe4] px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">
            {t('forms.ledger')}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {hasRange
              ? t('forms.ledgerPeriod', {
                  from: from || '…',
                  to: to || '…',
                })
              : t('forms.ledgerAllEntries')}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink/20 bg-[#efe9db] text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-3 py-2.5 text-start font-semibold">{t('forms.date')}</th>
                <th className="px-3 py-2.5 text-start font-semibold">{t('forms.particulars')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{t('forms.debit')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{t('forms.credit')}</th>
                <th className="px-3 py-2.5 text-end font-semibold">{t('forms.balance')}</th>
              </tr>
            </thead>
            <tbody>
              {showOpening ? (
                <tr className="border-b border-ink/10 italic text-ink-muted">
                  <td className="px-3 py-2.5 whitespace-nowrap" />
                  <td className="px-3 py-2.5">{t('forms.balanceBroughtForward')}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums" />
                  <td className="px-3 py-2.5 text-end tabular-nums" />
                  <td className="px-3 py-2.5 text-end tabular-nums font-medium text-ink">
                    {formatMoney(openingBalance)}
                  </td>
                </tr>
              ) : null}

              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-ink-muted">
                    {t('empty.noLedgerInRange')}
                  </td>
                </tr>
              ) : (
                rows.map((entry) => {
                  const debit = entry.amount > 0 ? entry.amount : 0
                  const credit = entry.amount < 0 ? Math.abs(entry.amount) : 0
                  return (
                    <tr key={entry.id} className="border-b border-ink/10 text-ink">
                      <td className="px-3 py-2.5 whitespace-nowrap align-top text-ink-muted">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-3 py-2.5 align-top">{particulars(entry)}</td>
                      <td className="px-3 py-2.5 text-end align-top tabular-nums text-warning">
                        {debit ? formatMoney(debit) : ''}
                      </td>
                      <td className="px-3 py-2.5 text-end align-top tabular-nums text-success">
                        {credit ? formatMoney(credit) : ''}
                      </td>
                      <td className="px-3 py-2.5 text-end align-top tabular-nums font-medium">
                        {formatMoney(entry.balanceAfter)}
                      </td>
                    </tr>
                  )
                })
              )}

              <tr className="border-t-2 border-ink/25 bg-[#efe9db] font-semibold text-ink">
                <td className="px-3 py-2.5" colSpan={2}>
                  {t('forms.totals')}
                </td>
                <td className="px-3 py-2.5 text-end tabular-nums">{formatMoney(debitTotal)}</td>
                <td className="px-3 py-2.5 text-end tabular-nums">{formatMoney(creditTotal)}</td>
                <td className="px-3 py-2.5 text-end tabular-nums" />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-ink/15 bg-[#f3efe4] px-4 py-3">
          <span className="text-sm font-semibold text-ink">{t('forms.closingBalance')}</span>
          <span className="text-base font-bold tabular-nums text-ink">
            {formatMoney(closingBalance)}
          </span>
        </div>
      </div>
    </div>
  )
}
