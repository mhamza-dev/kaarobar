import { useState } from 'react'
import { Printer, RotateCcw, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import { useFormatDate } from '../../../lib/useFormatDate'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Table,
  useToast,
} from '../../../components/ui'
import { PageHeader } from '../../../components/layout'
import { useBarcodeScanner } from '../../pos/useBarcodeScanner'
import { useActionVisibility } from '../../../lib/nav'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { saleStatusTone, statusLabel } from '../../../lib/statusLabel'
import { toastSalePrintResult } from '../../../lib/printReceipt'
import { looksLikeInvoiceBarcode } from '../../../../shared/invoice'
import type { SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
  onOpenSale: (saleId: string) => void
}

export function SalesPage({ user, data, onOpenSale }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const { formatDateTime } = useFormatDate()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const { sales, activeBusinessId } = data

  // Held as ids rather than rows: the sales list is refetched after a delete,
  // so anything holding row objects would be pointing at rows that no longer
  // exist by the time the confirm dialog closes.
  const [pendingDelete, setPendingDelete] = useState<{
    ids: string[]
    clear: () => void
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function deleteSelected(ids: string[], clearSelection: () => void) {
    setDeleting(true)
    const failures: string[] = []
    // One at a time, and deliberately not aborted on the first failure: a sale
    // that refuses to delete should not strand the rest, and the cashier needs
    // to be told which ones are still there.
    for (const id of ids) {
      try {
        await window.api.sales.remove({ saleId: id })
      } catch (_e) {
        const sale = sales.find((row) => row.id === id)
        failures.push(sale?.invoiceNo ?? id)
      }
    }
    setDeleting(false)
    setPendingDelete(null)
    clearSelection()
    await data.refreshAll()

    const deleted = ids.length - failures.length
    if (deleted > 0) toast.success(t('toast.salesDeleted', { count: deleted }))
    if (failures.length > 0) {
      toast.error(t('toast.salesDeleteFailed', { invoices: failures.join(', ') }))
    }
  }

  useBarcodeScanner({
    enabled: Boolean(activeBusinessId),
    onScan: (code) => {
      void (async () => {
        if (!activeBusinessId) return
        const invoiceNo = code.trim()
        if (!looksLikeInvoiceBarcode(invoiceNo)) {
          toast.error(t('toast.invoiceScanInvalid'))
          return
        }
        try {
          const sale = await window.api.sales.findByInvoice({
            businessId: activeBusinessId,
            invoiceNo,
          })
          if (!sale) {
            toast.error(t('toast.invoiceNotFound', { invoice: invoiceNo }))
            return
          }
          toast.success(t('toast.invoiceOpened', { invoice: sale.invoiceNo }))
          onOpenSale(sale.id)
        } catch (e) {
          toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
        }
      })()
    },
  })

  const saleActions = (row: (typeof sales)[number]) => [
    ...(actions.canPrint
      ? [
          {
            id: 'reprint',
            label: t('forms.reprint'),
            icon: <Printer className="size-4" />,
            onSelect: async () => {
              try {
                const printResult = await window.api.sales.printReceipt(row.id)
                toastSalePrintResult(printResult, toast, t)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
              }
            },
          },
        ]
      : []),
    ...(actions.canRequestRefund &&
    (row.status === 'completed' || row.status === 'partially_refunded')
      ? [
          {
            id: 'refund',
            label: t('forms.createRefund'),
            icon: <RotateCcw className="size-4" />,
            onSelect: () => onOpenSale(row.id),
          },
        ]
      : []),
    ...(actions.canDeleteSales
      ? [
          {
            id: 'delete',
            label: t('forms.deleteSale'),
            icon: <Trash2 className="size-4" />,
            danger: true,
            onSelect: () => setPendingDelete({ ids: [row.id], clear: () => undefined }),
          },
        ]
      : []),
  ]

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrowSales')}
        title={t('dashboard.sales')}
        description={t('dashboard.salesScanDesc')}
      />

      <Card title={t('dashboard.salesHistory')} description={t('dashboard.salesDesc')}>
        {sales.length === 0 ? (
          <EmptyState title={t('empty.noSales')} description={t('empty.noSalesDesc')} />
        ) : (
          <Table
            embedded
            pageSize={10}
            rowKey={(row) => row.id}
            rows={sales}
            onRowClick={(row) => onOpenSale(row.id)}
            selectable={actions.canDeleteSales}
            bulkActions={({ keys, clear }) => (
              <Button
                type="button"
                variant="danger"
                size="sm"
                onClick={() => setPendingDelete({ ids: keys, clear })}
              >
                <Trash2 className="size-4" />
                {t('table.bulkDelete')}
              </Button>
            )}
            search={{
              getText: (row) => row.invoiceNo,
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
                id: 'customer',
                label: t('table.customerType'),
                type: 'select',
                options: [
                  { value: 'walkin', label: t('table.walkIn') },
                  { value: 'linked', label: t('table.withCustomer') },
                ],
                getValue: (row) => (row.customerId ? 'linked' : 'walkin'),
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
                key: 'status',
                label: t('forms.status'),
                render: (row) => (
                  <Badge tone={saleStatusTone(row.status)}>
                    {statusLabel(t, 'sale', row.status)}
                  </Badge>
                ),
              },
            ]}
            mobileCardActions={(row) => <RowActionsMenu actions={saleActions(row)} />}
            columns={[
              {
                key: 'invoice',
                header: t('forms.invoice'),
                render: (row) => <span className="font-medium">{row.invoiceNo}</span>,
              },
              {
                key: 'date',
                header: t('forms.date'),
                width: 'w-48',
                render: (row) => (
                  <span className="tabular-nums text-ink-muted">{formatDateTime(row.createdAt)}</span>
                ),
              },
              {
                key: 'total',
                header: t('forms.total'),
                render: (row) => formatMoney(row.total),
              },
              {
                key: 'status',
                header: t('forms.status'),
                render: (row) => (
                  <Badge tone={saleStatusTone(row.status)}>
                    {statusLabel(t, 'sale', row.status)}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: <span className="sr-only">{t('forms.actions')}</span>,
                width: 'w-28',
                align: 'end',
                render: (row) => <RowActionsMenu actions={saleActions(row)} />,
              },
            ]}
          />
        )}
      </Card>

      <ConfirmDialog
        open={pendingDelete !== null}
        loading={deleting}
        danger
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void deleteSelected(pendingDelete.ids, pendingDelete.clear)
        }}
        title={t('forms.deleteSaleTitle', { count: pendingDelete?.ids.length ?? 0 })}
        description={t('forms.deleteSaleConfirm')}
        confirmLabel={t('forms.deleteSale')}
      />
    </div>
  )
}
