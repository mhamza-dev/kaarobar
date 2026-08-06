import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Wallet } from 'lucide-react'
import { Form, Formik } from 'formik'
import * as yup from 'yup'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import { useFormatDate } from '../../../lib/useFormatDate'
import { paymentMethodI18nKey } from '../../../lib/paymentMethodI18n'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Table,
  useToast,
} from '../../../components/ui'
import { FormNumberField, FormSelectField, FormTextField } from '../../../components/form'
import { PageHeader } from '../../../components/layout'
import { useActionVisibility } from '../../../lib/nav'
import { saleStatusTone, statusLabel } from '../../../lib/statusLabel'
import { CustomerLedgerBook } from '../components/CustomerLedgerBook'
import type { CustomerDetail, SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
  customerId: string
  onBack: () => void
  onOpenSale: (saleId: string) => void
}

export function CustomerDetailPage({ user, data, customerId, onBack, onOpenSale }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const formatMoney = useFormatMoney()
  const { formatDateTime } = useFormatDate()
  const actions = useActionVisibility(user)
  const [detail, setDetail] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paymentOpen, setPaymentOpen] = useState(false)
  const { activeBusinessId, refreshScopedData } = data

  const paymentSchema = yup.object({
    amount: yup
      .number()
      .typeError(t('forms.paymentAmountRequired'))
      .required(t('forms.paymentAmountRequired'))
      .moreThan(0, t('forms.paymentAmountRequired')),
    method: yup.mixed<'cash' | 'card'>().oneOf(['cash', 'card']).required(),
    note: yup.string().trim().optional(),
  })

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setDetail(await window.api.customers.getDetail(customerId))
    } catch (e) {
      setError(e instanceof Error ? e.message : t('toast.actionFailed'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [customerId])

  const summary = useMemo(() => {
    if (!detail) {
      return { purchaseTotal: 0, salesCount: 0, paymentsReceived: 0 }
    }
    const purchaseTotal = detail.sales
      .filter((sale) => sale.status === 'completed' || sale.status === 'partially_refunded')
      .reduce((sum, sale) => sum + sale.total, 0)
    const paymentsReceived = detail.ledger
      .filter((entry) => entry.type === 'payment')
      .reduce((sum, entry) => sum + Math.abs(entry.amount), 0)
    return {
      purchaseTotal,
      salesCount: detail.sales.length,
      paymentsReceived,
    }
  }, [detail])

  const canRecordPayment =
    Boolean(detail) && actions.canEditCustomers && (detail?.remainingBalance ?? 0) > 0

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
        title={detail?.customer.name ?? t('forms.customerDetail')}
        description={
          detail
            ? [detail.customer.phone, t('forms.credit')].filter(Boolean).join(' · ')
            : t('dashboard.customerDetailDesc')
        }
        actions={
          canRecordPayment ? (
            <Button type="button" onClick={() => setPaymentOpen(true)}>
              <Wallet className="size-4" />
              {t('forms.recordPayment')}
            </Button>
          ) : null
        }
      />

      {loading ? <p className="mb-4 text-sm text-ink-muted">{t('common.loading')}</p> : null}
      {error ? (
        <div className="mb-4 flex flex-wrap items-center gap-2" role="alert">
          <Badge tone="danger">{error}</Badge>
          <Button variant="ghost" size="sm" onClick={() => void load()}>
            {t('common.dismiss')}
          </Button>
        </div>
      ) : null}

      {detail ? (
        <div className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-brand-primary/15 bg-gradient-to-br from-brand-tint/70 via-surface-raised to-surface-raised p-5 shadow-soft">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={detail.customer.isActive ? 'success' : 'neutral'}>
                {detail.customer.isActive ? t('common.active') : t('common.inactive')}
              </Badge>
              {detail.customer.phone ? (
                <span className="text-sm text-ink-muted">{detail.customer.phone}</span>
              ) : null}
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{detail.customer.name}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink-muted">
              <span>
                {t('forms.remainingToPay')}:{' '}
                <span className="font-medium text-ink">{formatMoney(detail.remainingBalance)}</span>
              </span>
              <span>
                {t('forms.salesCount')}:{' '}
                <span className="font-medium text-ink">{summary.salesCount}</span>
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Card title={t('forms.remainingToPay')} accent="warning">
              <p className="text-xl font-bold text-ink">{formatMoney(detail.remainingBalance)}</p>
              <p className="mt-1 text-xs text-ink-muted">{t('forms.credit')}</p>
            </Card>
            <Card title={t('forms.lifetimePurchases')} accent="brand">
              <p className="text-xl font-bold text-ink">{formatMoney(summary.purchaseTotal)}</p>
              <p className="mt-1 text-xs text-ink-muted">
                {t('forms.salesCount')}: {summary.salesCount}
              </p>
            </Card>
            <Card title={t('forms.salesCount')}>
              <p className="text-xl font-bold text-ink">{summary.salesCount}</p>
            </Card>
            <Card title={t('forms.paymentsReceived')} accent="success">
              <p className="text-xl font-bold text-ink">{formatMoney(summary.paymentsReceived)}</p>
            </Card>
          </div>

          <Card title={t('forms.ledger')} description={t('forms.ledgerDesc')}>
            <CustomerLedgerBook
              customerId={customerId}
              ledger={detail.ledger}
              sales={detail.sales}
              canPrint={actions.canPrint}
            />
          </Card>

          <Card title={t('forms.purchaseHistory')} description={t('forms.purchaseHistoryDesc')}>
            {detail.sales.length === 0 ? (
              <EmptyState title={t('empty.noSales')} description={t('empty.noSalesDesc')} />
            ) : (
              <Table
                embedded
                pageSize={10}
                rowKey={(row) => row.id}
                rows={detail.sales}
                onRowClick={(row) => onOpenSale(row.id)}
                search={{
                  getText: (row) =>
                    `${row.invoiceNo} ${row.paymentMethods.join(' ')} ${statusLabel(t, 'sale', row.status)}`,
                }}
                filters={[
                  {
                    id: 'status',
                    label: t('forms.status'),
                    type: 'select',
                    options: [
                      { value: 'completed', label: statusLabel(t, 'sale', 'completed') },
                      { value: 'void', label: statusLabel(t, 'sale', 'void') },
                      { value: 'refunded', label: statusLabel(t, 'sale', 'refunded') },
                      {
                        value: 'partially_refunded',
                        label: statusLabel(t, 'sale', 'partially_refunded'),
                      },
                    ],
                    getValue: (row) => row.status,
                  },
                  {
                    id: 'payment',
                    label: t('forms.paymentType'),
                    type: 'select',
                    options: [
                      { value: 'cash', label: t('payment.cash') },
                      { value: 'card', label: t('payment.card') },
                      { value: 'credit', label: t('payment.credit') },
                    ],
                    getValue: (row) => row.paymentMethods.join(','),
                  },
                  {
                    id: 'total',
                    label: t('table.totalRange'),
                    type: 'numberRange',
                    getValue: (row) => row.total,
                  },
                  {
                    id: 'date',
                    label: t('table.dateRange'),
                    type: 'dateRange',
                    getValue: (row) => row.createdAt,
                  },
                ]}
                mobileCardTitle={(row) => row.invoiceNo}
                mobileCardSubtitle={(row) => formatMoney(row.total)}
                mobileCardFields={[
                  {
                    key: 'date',
                    label: t('forms.date'),
                    render: (row) => formatDateTime(row.createdAt),
                  },
                  {
                    key: 'payment',
                    label: t('forms.paymentType'),
                    render: (row) =>
                      row.paymentMethods.length
                        ? row.paymentMethods
                            .map((m) => t(paymentMethodI18nKey(m), { defaultValue: m }))
                            .join(', ')
                        : '—',
                  },
                  {
                    key: 'status',
                    label: t('forms.status'),
                    render: (row) => (
                      <Badge tone={saleStatusTone(row.status)}>
                        {statusLabel(t, 'sale', row.status)}
                      </Badge>
                    ),
                  },
                ]}
                columns={[
                  { key: 'invoice', header: t('forms.invoice'), render: (row) => row.invoiceNo },
                  {
                    key: 'date',
                    header: t('forms.date'),
                    render: (row) => formatDateTime(row.createdAt),
                  },
                  {
                    key: 'total',
                    header: t('forms.total'),
                    render: (row) => formatMoney(row.total),
                  },
                  {
                    key: 'payment',
                    header: t('forms.paymentType'),
                    render: (row) =>
                      row.paymentMethods.length
                        ? row.paymentMethods
                            .map((m) => t(paymentMethodI18nKey(m), { defaultValue: m }))
                            .join(', ')
                        : '—',
                  },
                  {
                    key: 'status',
                    header: t('forms.status'),
                    width: 'w-40',
                    render: (row) => (
                      <Badge tone={saleStatusTone(row.status)}>
                        {statusLabel(t, 'sale', row.status)}
                      </Badge>
                    ),
                  },
                ]}
              />
            )}
          </Card>
        </div>
      ) : null}

      <Modal
        open={paymentOpen && Boolean(detail)}
        onClose={() => setPaymentOpen(false)}
        title={t('forms.recordPayment')}
      >
        {detail ? (
          <Formik
            initialValues={{
              amount: '',
              method: 'cash' as 'cash' | 'card',
              note: '',
            }}
            validationSchema={paymentSchema}
            onSubmit={async (values) => {
              try {
                const amount = Number(values.amount)
                if (amount > detail.remainingBalance) {
                  toast.error(t('forms.paymentExceedsBalance'))
                  return
                }
                await window.api.customers.recordPayment({
                  customerId,
                  amount,
                  method: values.method,
                  note: values.note || null,
                })
                toast.success(t('toast.paymentRecorded'))
                setPaymentOpen(false)
                await load()
                if (activeBusinessId) await refreshScopedData(activeBusinessId)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-3">
                <p className="text-sm text-ink-muted">
                  {t('forms.remainingToPay')}: {formatMoney(detail.remainingBalance)}
                </p>
                <FormNumberField name="amount" label={t('forms.amount')} min={0} step="0.01" />
                <FormSelectField
                  name="method"
                  label={t('forms.paymentType')}
                  options={[
                    { value: 'cash', label: t('payment.cash') },
                    { value: 'card', label: t('payment.card') },
                  ]}
                />
                <FormTextField name="note" label={t('forms.notes')} />
                <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                  <Button type="button" variant="secondary" onClick={() => setPaymentOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" loading={isSubmitting}>
                    {t('forms.recordPayment')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        ) : null}
      </Modal>
    </div>
  )
}
