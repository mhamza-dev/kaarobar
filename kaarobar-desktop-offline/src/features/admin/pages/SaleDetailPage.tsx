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
    const refundedAmount = detail.items.reduce(
      (sum, item) => sum + item.refundedQty * item.unitPrice,
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
                    await window.api.sales.printReceipt(detail.sale.id)
                    toast.success(t('toast.receiptPrinted'))
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
          <div className="overflow-hidden rounded-lg border border-brand-primary/15 bg-gradient-to-br from-brand-tint/70 via-surface-raised to-surface-raised p-5 shadow-soft">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={saleStatusTone(detail.sale.status)}>
                {statusLabel(t, 'sale', detail.sale.status)}
              </Badge>
              <span className="text-sm text-ink-muted">
                {formatDateTime(detail.sale.createdAt)}
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{detail.sale.invoiceNo}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink-muted">
              {detail.sale.servedByName ? (
                <span>{t('pos.servedBy')}: <span className="font-medium text-ink">{detail.sale.servedByName}</span></span>
              ) : null}
              {detail.sale.serviceMode ? (
                <span>{t('pos.serviceMode')}: <span className="font-medium text-ink">{t(`serviceModes.${detail.sale.serviceMode}`)}</span></span>
              ) : null}
              {detail.sale.tableName ? (
                <span>{t('tables.name')}: <span className="font-medium text-ink">{detail.sale.tableName}</span></span>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card title={t('forms.netSaleTotal')}>
              <p className="text-xl font-bold text-ink">{formatMoney(paymentSummary.netTotal)}</p>
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
            <Card title={t('forms.paymentAfterRefund')} accent="success">
              <p className="text-xl font-bold text-ink">{formatMoney(paymentSummary.netPayment)}</p>
              {paymentSummary.refundedAmount > 0 ? (
                <p className="mt-1 text-xs text-ink-muted">
                  {t('forms.totalPayment')}: {formatMoney(paymentSummary.totalPaid)}
                </p>
              ) : null}
            </Card>
            <Card title={t('forms.remainingToPay')} accent="warning">
              <p className="text-xl font-bold text-ink">{formatMoney(paymentSummary.remainingSalePayment)}</p>
            </Card>
            <Card title={t('forms.refundedPayment')} accent="danger">
              <p className="text-xl font-bold text-ink">{formatMoney(paymentSummary.refundedAmount)}</p>
            </Card>
          </div>

          <Card title={t('forms.lineItems')}>
            <div className="space-y-2">
              {detail.items.map((item) => {
                const netQty = Math.max(0, item.qty - item.refundedQty)
                const netLineTotal = netQty * item.unitPrice
                return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-sm"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-ink">{item.productName}</p>
                      {item.refundedQty > 0 ? <Badge tone="warning">{t('forms.refunded')}</Badge> : null}
                    </div>
                    <p className="text-xs text-ink-muted">
                      {item.qty} × {formatMoney(item.unitPrice)} · {t('forms.refunded')}: {item.refundedQty} ·{' '}
                      {t('forms.refundable')}: {item.refundableQty}
                    </p>
                  </div>
                  <div className="text-end">
                    <span className="font-medium text-ink">{formatMoney(netLineTotal)}</span>
                    {item.refundedQty > 0 ? (
                      <p className="text-xs text-ink-subtle line-through">{formatMoney(item.lineTotal)}</p>
                    ) : null}
                  </div>
                </div>
                )
              })}
            </div>
          </Card>

          {detail.payments.length > 0 ? (
            <Card title={t('forms.paymentType')}>
              <div className="mb-3 space-y-1 rounded-lg border border-line bg-surface-muted px-3 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">{t('forms.subtotal')}</span>
                  <span className="font-medium text-ink">{formatMoney(paymentSummary.subtotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">{t('forms.discount')}</span>
                  <span className="font-medium text-ink">
                    {paymentSummary.discount > 0
                      ? `−${formatMoney(paymentSummary.discount)}`
                      : formatMoney(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">{t('forms.saleTotal')}</span>
                  <span className="font-medium text-ink">{formatMoney(paymentSummary.saleTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">{t('forms.refundedAmount')}</span>
                  <span className="font-medium text-ink">
                    {paymentSummary.refundedAmount > 0
                      ? `−${formatMoney(paymentSummary.refundedAmount)}`
                      : formatMoney(0)}
                  </span>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-1">
                  <span className="text-ink-muted">{t('forms.netSaleTotal')}</span>
                  <span className="font-semibold text-ink">{formatMoney(paymentSummary.netTotal)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">{t('forms.totalPayment')}</span>
                  <span className="font-medium text-ink">{formatMoney(paymentSummary.totalPaid)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">{t('forms.paymentAfterRefund')}</span>
                  <span className="font-semibold text-ink">{formatMoney(paymentSummary.netPayment)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-ink-muted">{t('forms.remainingSalePayment')}</span>
                  <span className="font-medium text-ink">
                    {formatMoney(paymentSummary.remainingSalePayment)}
                  </span>
                </div>
              </div>
              <ul className="space-y-1 text-sm">
                {detail.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between">
                    <span>{t(paymentMethodI18nKey(payment.method), { defaultValue: payment.method })}</span>
                    <span>{formatMoney(payment.amount)}</span>
                  </li>
                ))}
              </ul>
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
