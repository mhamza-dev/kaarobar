import { useEffect, useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import { Badge, Button, Card, EmptyState, Table, useToast } from '../../../components/ui'
import { PageHeader } from '../../../components/layout'
import { poStatusTone, statusLabel } from '../../../lib/statusLabel'
import { hasLicenseFeature, useLicenseFeatures } from '../../../lib/license'
import type { PurchaseOrderDetail, SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
  poId: string
  onBack: () => void
}

export function PoDetailPage({ user: _user, data: _data, poId, onBack }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const [detail, setDetail] = useState<PurchaseOrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [printing, setPrinting] = useState(false)
  const licenseFeatures = useLicenseFeatures()

  async function load() {
    setLoading(true)
    try {
      setDetail(await window.api.purchaseOrders.getDetail(poId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [poId])

  if (!hasLicenseFeature(licenseFeatures, 'purchase_orders')) return null

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
          detail ? `${t('forms.poNumber')} ${detail.po.poNumber}` : t('forms.poDetail')
        }
        description={
          loading
            ? t('common.loading')
            : detail
              ? `${detail.supplierName} · ${detail.branchName} · ${detail.po.orderDate}`
              : undefined
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              loading={printing}
              disabled={!detail}
              onClick={async () => {
                setPrinting(true)
                try {
                  await window.api.purchaseOrders.print(poId)
                  toast.success(t('toast.poPrinted'))
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : t('toast.poPrintFailed'))
                } finally {
                  setPrinting(false)
                }
              }}
            >
              <Printer className="size-4" />
              {t('forms.printPo')}
            </Button>
          </div>
        }
      />

      {detail ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg border border-brand-primary/15 bg-gradient-to-br from-brand-tint/70 via-surface-raised to-surface-raised p-5 shadow-soft">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={poStatusTone(detail.po.status)}>
                {statusLabel(t, 'po', detail.po.status)}
              </Badge>
              <span className="text-sm text-ink-muted">{detail.po.orderDate}</span>
            </div>
            <p className="mt-2 text-2xl font-bold tracking-tight text-ink">{detail.po.poNumber}</p>
            <p className="mt-1 text-sm text-ink-muted">
              {detail.supplierName} · {detail.branchName}
            </p>
          </div>

          <Card title={t('forms.poDetail')}>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>
                <span className="text-ink-muted">{t('forms.supplier')}: </span>
                {detail.supplierName}
              </p>
              <p>
                <span className="text-ink-muted">{t('forms.branch')}: </span>
                {detail.branchName}
              </p>
              <p>
                <span className="text-ink-muted">{t('forms.orderDate')}: </span>
                {detail.po.orderDate}
              </p>
              <p className="flex items-center gap-2">
                <span className="text-ink-muted">{t('forms.status')}: </span>
                <Badge tone={poStatusTone(detail.po.status)}>
                  {statusLabel(t, 'po', detail.po.status)}
                </Badge>
              </p>
            </div>
          </Card>

          <Card title={t('forms.poItems')}>
            {detail.items.length === 0 ? (
              <EmptyState title={t('empty.noPoItems')} />
            ) : (
              <Table
                embedded
                pageSize={20}
                rowKey={(row) => row.id}
                rows={detail.items}
                mobileCardTitle={(row) => row.productName}
                mobileCardSubtitle={(row) => `${t('forms.qty')}: ${row.orderedQty}`}
                mobileCardFields={[
                  { key: 'cost', label: t('forms.unitCost'), render: (row) => formatMoney(row.unitCost) },
                  { key: 'total', label: t('forms.total'), render: (row) => formatMoney(row.lineTotal) },
                ]}
                columns={[
                  { key: 'name', header: t('forms.product'), render: (row) => row.productName },
                  {
                    key: 'qty',
                    header: t('forms.qty'),
                    width: 'w-24',
                    render: (row) => row.orderedQty,
                  },
                  {
                    key: 'cost',
                    header: t('forms.unitCost'),
                    render: (row) => formatMoney(row.unitCost),
                  },
                  {
                    key: 'total',
                    header: t('forms.total'),
                    render: (row) => formatMoney(row.lineTotal),
                  },
                ]}
              />
            )}
            <p className="mt-3 text-right text-base font-semibold text-ink">
              {t('forms.total')}: {formatMoney(detail.total)}
            </p>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
