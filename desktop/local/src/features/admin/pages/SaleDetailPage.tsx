import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import { useFormatDate } from '../../../lib/useFormatDate'
import { paymentMethodI18nKey } from '../../../lib/paymentMethodI18n'
import { ArrowLeft, Printer, RotateCcw } from 'lucide-react'
import { Badge, Button, Card, Modal, TextField, TextareaField, useToast } from '../../../components/ui'
import { PageHeader } from '../../../components/layout'
import { ActivityTimeline } from '../components/ActivityTimeline'
import { useActionVisibility } from '../../../lib/nav'
import { refundStatusTone, saleStatusTone, statusLabel } from '../../../lib/statusLabel'
import { toastSalePrintResult } from '../../../lib/printReceipt'
import type { SaleDetail, SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
  saleId: string
  onBack: () => void
}

export function SaleDetailPage({ user, data, saleId, onBack }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const { formatDateTime } = useFormatDate()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const [detail, setDetail] = useState<SaleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refundOpen, setRefundOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({})
  const [reviewNote, setReviewNote] = useState('')
  const { activeBusinessId, refreshScopedData } = data

  // A linked customer's name comes from their record; a walk-in's was written
  // on the sale itself. Either way the question "who was this for?" has one
  // answer, and it belongs at the top of the page next to the invoice number.
  const customerLabel = useMemo(() => {
    if (!detail) return null
    if (detail.sale.customerId) {
      const customer = data.customers.find((row) => row.id === detail.sale.customerId)
      return customer?.name ?? detail.sale.customerName
    }
    return detail.sale.customerName
  }, [detail, data.customers])

  async function load() {
    setLoading(true)
    try {
      const dataDetail = await window.api.sales.getDetail(saleId)
      setDetail(dataDetail)
      const initial: Record<string, number> = {}
      dataDetail.items.forEach((item) => {
        initial[item.id] = 0
      })
      setQtyByItem(initial)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    setRefundOpen(false)
    setReason('')
    setReviewNote('')
  }, [saleId])

  const canRefundSale =
    detail &&
    (detail.sale.status === 'completed' || detail.sale.status === 'partially_refunded') &&
    detail.items.some((item) => item.refundableQty > 0) &&
    !detail.refundRequests.some((r) => r.status === 'pending')

  const selectedItems = useMemo(() => {
    if (!detail) return []
    return detail.items
      .map((item) => ({ saleItemId: item.id, qty: qtyByItem[item.id] ?? 0, max: item.refundableQty }))
      .filter((item) => item.qty > 0)
  }, [detail, qtyByItem])

  const paymentSummary = useMemo(() => {
    if (!detail) {
      return {
        subtotal: 0,
        discount: 0,
        saleTotal: 0,
        refundedAmount: 0,
        totalPaid: 0,
        netTotal: 0,
        netPayment: 0,
        remainingSalePayment: 0,
      }
    }
    const subtotal = detail.sale.subtotal
    const discount = detail.sale.discount
    const saleTotal = detail.sale.total
    // Pro-rated from the line's own total, so a discounted line gives back what
    // the customer actually paid for those units. Multiplying the ticket price
    // by the refunded quantity would hand back more than was ever taken.
    const refundedAmount = detail.items.reduce(
      (sum, item) =>
        sum + (item.qty > 0 ? (item.lineTotal * item.refundedQty) / item.qty : 0),
      0,
    )
    const totalPaid = detail.payments.reduce((sum, payment) => sum + payment.amount, 0)
    const netTotal = Math.max(0, saleTotal - refundedAmount)
    // Cash/card kept after refund (recorded payments minus refunded merchandise value)
    const netPayment = Math.max(0, totalPaid - refundedAmount)
    const remainingSalePayment = Math.max(0, netTotal - netPayment)
    return {
      subtotal,
      discount,
      saleTotal,
      refundedAmount,
      totalPaid,
      netTotal,
      netPayment,
      remainingSalePayment,
    }
  }, [detail])

  async function onChanged() {
    if (activeBusinessId) await refreshScopedData(activeBusinessId)
    await load()
  }

  return (
    <div>
      <div className="mb-2">
        <Button
          variant="ghost"
          onClick={onBack}
          className="px-0 text-ink-muted hover:bg-transparent hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t('common.back')}
        </Button>
      </div>
      <PageHeader
        eyebrow={t('dashboard.eyebrowDetail')}
        title={
          detail
            ? `${t('forms.invoice')} ${detail.sale.invoiceNo}`
            : t('forms.saleDetail')
        }
        description={
          detail
            ? formatDateTime(detail.sale.createdAt)
            : t('dashboard.saleDetailDesc')
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {detail && actions.canPrint ? (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const printResult = await window.api.sales.printReceipt(detail.sale.id)
                    toastSalePrintResult(printResult, toast, t)
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
                  }
                }}
              >
                <Printer className="size-4" />
                {t('forms.reprint')}
              </Button>
            ) : null}
            {actions.canRequestRefund && canRefundSale ? (
              <Button onClick={() => setRefundOpen(true)}>
                <RotateCcw className="size-4" />
                {t('forms.createRefund')}
              </Button>
            ) : null}
          </div>
        }
      />

      {loading ? <p className="mb-4 text-sm text-ink-muted">{t('common.loading')}</p> : null}

      {detail ? (
        <div className="space-y-6">
          {/* The invoice number is the thing a shopkeeper is looking for when
              they open this page — a customer is standing there holding the
              paper one. It gets the display weight; everything else on the
              header is the context that makes it identifiable.

              A single brand rule down the edge instead of a gradient wash: the
              old `brand-tint` gradient has no dark-mode value, so it fell back
              to a pale band with near-invisible text on it. */}
          <header className="overflow-hidden rounded-xl border border-line bg-surface-raised shadow-soft">
            <div className="border-s-4 border-brand-primary p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-2xl font-bold tracking-tight text-ink">
                  {detail.sale.invoiceNo}
                </p>
                <Badge tone={saleStatusTone(detail.sale.status)}>
                  {statusLabel(t, 'sale', detail.sale.status)}
                </Badge>
                <span className="text-sm text-ink-muted">
                  {formatDateTime(detail.sale.createdAt)}
                </span>
              </div>

              {/* Who and how, as separated facts rather than a run-on sentence.
                  Only what this sale actually has: a retail sale carries none
                  of the table or rider fields, and empty labels are noise. */}
              <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {[
                  customerLabel ? { label: t('forms.customer'), value: customerLabel } : null,
                  detail.sale.servedByName
                    ? { label: t('pos.servedBy'), value: detail.sale.servedByName }
                    : null,
                  detail.sale.serviceMode
                    ? {
                        label: t('pos.serviceMode'),
                        value: t(`serviceModes.${detail.sale.serviceMode}`),
                      }
                    : null,
                  detail.sale.tableName
                    ? { label: t('tables.name'), value: detail.sale.tableName }
                    : null,
                  detail.sale.riderName
                    ? { label: t('pos.rider'), value: detail.sale.riderName }
                    : null,
                  detail.sale.deliveryStatus
                    ? {
                        label: t('pos.deliveryStatus'),
                        value: t(`deliveryStatus.${detail.sale.deliveryStatus}`),
                      }
                    : null,
                ]
                  .filter((fact): fact is { label: string; value: string } => fact !== null)
                  .map((fact) => (
                    <div key={fact.label} className="flex items-baseline gap-2">
                      <dt className="shrink-0 text-ink-muted">{fact.label}</dt>
                      <dd className="truncate font-medium text-ink">{fact.value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          </header>

          {/* One headline figure, three supporting ones. All four used to be
              equal-weight cards, which made "what is this sale worth?" and
              "what is still owed?" compete for the same glance. */}
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
            <Card title={t('forms.netSaleTotal')}>
              <p className="text-3xl font-bold tracking-tight tabular-nums text-ink">
                {formatMoney(paymentSummary.netTotal)}
              </p>
              {paymentSummary.discount > 0 || paymentSummary.refundedAmount > 0 ? (
                <p className="mt-1 text-xs text-ink-muted">
                  {paymentSummary.discount > 0
                    ? `${t('forms.discount')}: −${formatMoney(paymentSummary.discount)}`
                    : null}
                  {paymentSummary.discount > 0 && paymentSummary.refundedAmount > 0 ? ' · ' : null}
                  {paymentSummary.refundedAmount > 0
                    ? `${t('forms.originalTotal')}: ${formatMoney(paymentSummary.saleTotal)}`
                    : null}
                </p>
              ) : null}
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card title={t('forms.paymentAfterRefund')} accent="success">
                <p className="text-xl font-bold tabular-nums text-ink">
                  {formatMoney(paymentSummary.netPayment)}
                </p>
                {paymentSummary.refundedAmount > 0 ? (
                  <p className="mt-1 text-xs text-ink-muted">
                    {t('forms.totalPayment')}: {formatMoney(paymentSummary.totalPaid)}
                  </p>
                ) : null}
              </Card>
              {/* Owing and refunded are only interesting when they are not zero,
                  but they stay on screen either way: a blank where a number
                  should be reads as missing data, not as nothing owed. */}
              <Card
                title={t('forms.remainingToPay')}
                accent={paymentSummary.remainingSalePayment > 0 ? 'warning' : 'none'}
              >
                <p className="text-xl font-bold tabular-nums text-ink">
                  {formatMoney(paymentSummary.remainingSalePayment)}
                </p>
              </Card>
              <Card
                title={t('forms.refundedPayment')}
                accent={paymentSummary.refundedAmount > 0 ? 'danger' : 'none'}
              >
                <p className="text-xl font-bold tabular-nums text-ink">
                  {formatMoney(paymentSummary.refundedAmount)}
                </p>
              </Card>
            </div>
          </div>

          {/* The same shape as the basket in the checkout modal: name and
              arithmetic on the left, one column of money down the right edge.
              A cashier who just rang this sale up should recognise it. */}
          <Card title={t('forms.lineItems')}>
            <ul className="divide-y divide-line">
              {detail.items.map((item) => {
                const netQty = Math.max(0, item.qty - item.refundedQty)
                // Pro-rated from what was actually charged, not from the list
                // price: a discounted line refunded in part gives back what the
                // customer paid for those units, not what they were ticketed at.
                const netLineTotal = item.qty > 0 ? (item.lineTotal * netQty) / item.qty : 0
                const perUnitDiscount = item.qty > 0 ? item.discount / item.qty : 0
                const gross = item.qty * item.unitPrice
                return (
                  <li
                    key={item.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-ink">{item.productName}</span>
                      {item.refundedQty > 0 ? (
                        <Badge tone="warning">{t('forms.refunded')}</Badge>
                      ) : null}
                    </div>
                    <span className="min-w-[6rem] text-end font-semibold tabular-nums text-ink">
                      {formatMoney(netLineTotal)}
                    </span>

                    <div className="col-start-1 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                      <span className="tabular-nums">
                        {item.qty} × {formatMoney(item.unitPrice)}
                      </span>
                      {item.discount > 0 ? (
                        <>
                          <span aria-hidden className="text-ink-subtle">
                            ·
                          </span>
                          <span className="font-medium tabular-nums text-danger">
                            {t('table.itemDiscount')} −{formatMoney(perUnitDiscount)}{' '}
                            {t('pos.discountPerUnitApplied', {
                              qty: item.qty,
                              total: formatMoney(item.discount),
                            })}
                          </span>
                        </>
                      ) : null}
                      {item.refundedQty > 0 ? (
                        <>
                          <span aria-hidden className="text-ink-subtle">
                            ·
                          </span>
                          <span className="tabular-nums">
                            {t('forms.refunded')}: {item.refundedQty} · {t('forms.refundable')}:{' '}
                            {item.refundableQty}
                          </span>
                        </>
                      ) : null}
                    </div>

                    {/* The ticketed value, struck through, only when it differs
                        from what was charged — because the line was discounted,
                        because part of it came back, or both. */}
                    {item.refundedQty > 0 || item.discount > 0 ? (
                      <span className="col-start-2 mt-1 text-end text-xs tabular-nums text-ink-subtle line-through">
                        {formatMoney(gross)}
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </Card>


          {/* Two questions, answered side by side: what the customer was
              charged, and what the shop has actually got. These were one
              undifferentiated ladder of eight rows, where the figure somebody
              came for sat in the middle of seven others. */}
          {detail.payments.length > 0 ? (
            <Card title={t('forms.paymentType')}>
              <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
                <dl className="space-y-1.5 text-sm">
                  <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                    {t('forms.saleTotal')}
                  </p>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted">{t('forms.subtotal')}</dt>
                    <dd className="tabular-nums text-ink">
                      {formatMoney(paymentSummary.subtotal)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted">{t('forms.discount')}</dt>
                    <dd className="tabular-nums text-ink">
                      {paymentSummary.discount > 0
                        ? `−${formatMoney(paymentSummary.discount)}`
                        : formatMoney(0)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-ink-muted">{t('forms.refundedAmount')}</dt>
                    <dd className="tabular-nums text-ink">
                      {paymentSummary.refundedAmount > 0
                        ? `−${formatMoney(paymentSummary.refundedAmount)}`
                        : formatMoney(0)}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5 font-semibold text-ink">
                    <dt>{t('forms.netSaleTotal')}</dt>
                    <dd className="tabular-nums">{formatMoney(paymentSummary.netTotal)}</dd>
                  </div>
                </dl>

                <dl className="space-y-1.5 text-sm">
                  <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                    {t('forms.totalPayment')}
                  </p>
                  {/* How it was tendered, before the arithmetic — the answer to
                      "was this cash or card?" is the one people ask this card
                      for most often. */}
                  {detail.payments.map((payment) => (
                    <div key={payment.id} className="flex items-baseline justify-between gap-3">
                      <dt className="text-ink-muted">
                        {t(paymentMethodI18nKey(payment.method), {
                          defaultValue: payment.method,
                        })}
                      </dt>
                      <dd className="tabular-nums text-ink">{formatMoney(payment.amount)}</dd>
                    </div>
                  ))}
                  <div className="flex items-baseline justify-between gap-3 border-t border-line pt-1.5 font-semibold text-ink">
                    <dt>{t('forms.paymentAfterRefund')}</dt>
                    <dd className="tabular-nums">{formatMoney(paymentSummary.netPayment)}</dd>
                  </div>
                  <div
                    className={`flex items-baseline justify-between gap-3 ${
                      paymentSummary.remainingSalePayment > 0
                        ? 'font-semibold text-warning'
                        : 'text-ink-muted'
                    }`}
                  >
                    <dt>{t('forms.remainingSalePayment')}</dt>
                    <dd className="tabular-nums">
                      {formatMoney(paymentSummary.remainingSalePayment)}
                    </dd>
                  </div>
                </dl>
              </div>
            </Card>
          ) : null}


          <Card title={t('forms.refundRequests')}>
            {detail.refundRequests.length === 0 ? (
              <p className="text-sm text-ink-muted">{t('empty.noRefundRequests')}</p>
            ) : (
              <div className="space-y-3">
                {detail.refundRequests.map((req) => (
                  <div key={req.id} className="rounded-lg border border-line p-3 text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Badge tone={refundStatusTone(req.status)}>
                        {statusLabel(t, 'refund', req.status)}
                      </Badge>
                      <span className="text-ink-muted">
                        {req.requestedByName} · {formatDateTime(req.createdAt)}
                      </span>
                    </div>
                    <p className="text-ink">{req.reason}</p>
                    <ul className="mt-1 list-disc ps-5 text-ink-muted">
                      {req.items.map((item) => (
                        <li key={item.id}>
                          {item.productName} × {item.qty}
                        </li>
                      ))}
                    </ul>
                    {req.reviewedByName ? (
                      <p className="mt-1 text-xs text-ink-muted">
                        {t('forms.reviewedBy')}: {req.reviewedByName}
                        {req.reviewedAt ? ` · ${formatDateTime(req.reviewedAt)}` : ''}
                        {req.reviewNote ? ` · ${req.reviewNote}` : ''}
                      </p>
                    ) : null}
                    {actions.canApproveRefund && req.status === 'pending' ? (
                      <div className="mt-3 space-y-2">
                        <TextField
                          label={t('forms.reviewNote')}
                          value={reviewNote}
                          onChange={(e) => setReviewNote(e.target.value)}
                        />
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await window.api.sales.reviewRefundRequest({
                                  id: req.id,
                                  decision: 'approve',
                                  note: reviewNote || undefined,
                                })
                                toast.success(t('toast.refundApproved'))
                                await onChanged()
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
                              }
                            }}
                          >
                            {t('forms.approve')}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={async () => {
                              try {
                                await window.api.sales.reviewRefundRequest({
                                  id: req.id,
                                  decision: 'reject',
                                  note: reviewNote || undefined,
                                })
                                toast.success(t('toast.refundRejected'))
                                await onChanged()
                              } catch (e) {
                                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
                              }
                            }}
                          >
                            {t('forms.reject')}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title={t('forms.activityHistory')}>
            <ActivityTimeline entries={detail.activity} />
          </Card>
        </div>
      ) : null}

      <Modal
        open={refundOpen && actions.canRequestRefund && Boolean(canRefundSale)}
        onClose={() => setRefundOpen(false)}
        title={t('forms.createRefund')}
        size="lg"
      >
        {detail ? (
          <div className="space-y-3">
            <div className="max-h-64 space-y-2 overflow-y-auto pe-1">
              {detail.items
                .filter((item) => item.refundableQty > 0)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-ink">{item.productName}</p>
                      <p className="text-xs text-ink-muted">
                        {t('forms.refundable')}: {item.refundableQty}
                      </p>
                    </div>
                    <TextField
                      type="number"
                      className="w-24"
                      min={0}
                      max={item.refundableQty}
                      value={String(qtyByItem[item.id] ?? 0)}
                      onChange={(e) =>
                        setQtyByItem((prev) => ({
                          ...prev,
                          [item.id]: Math.min(
                            item.refundableQty,
                            Math.max(0, Number(e.target.value) || 0),
                          ),
                        }))
                      }
                      aria-label={t('forms.refundQty')}
                    />
                  </div>
                ))}
            </div>
            <TextareaField
              label={t('forms.reason')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
            />
            <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
              <Button variant="secondary" onClick={() => setRefundOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                disabled={!reason.trim() || selectedItems.length === 0}
                onClick={async () => {
                  try {
                    await window.api.sales.createRefundRequest({
                      saleId: detail.sale.id,
                      reason: reason.trim(),
                      items: selectedItems.map(({ saleItemId, qty }) => ({ saleItemId, qty })),
                    })
                    toast.success(t('toast.refundRequested'))
                    setRefundOpen(false)
                    setReason('')
                    await onChanged()
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
                  }
                }}
              >
                {t('forms.submitRefundRequest')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
