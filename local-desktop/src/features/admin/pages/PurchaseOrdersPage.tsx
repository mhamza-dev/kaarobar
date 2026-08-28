import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Table,
} from '../../../components/ui'
import { PageHeader } from '../../../components/layout'
import { useActionVisibility } from '../../../lib/nav'
import { hasLicenseFeature, useLicenseFeatures } from '../../../lib/license'
import { CreatePoModal } from '../modals/CreatePoModal'
import { poStatusTone, statusLabel } from '../../../lib/statusLabel'
import type { SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
  onOpenPo: (id: string) => void
}

export function PurchaseOrdersPage({ user, data, onOpenPo }: Props) {
  const { t } = useTranslation()
  const actions = useActionVisibility(user)
  const [poOpen, setPoOpen] = useState(false)
  const {
    purchaseOrders,
    branchOptions,
    supplierOptions,
    activeBusinessId,
    refreshScopedData,
  } = data
  const licenseFeatures = useLicenseFeatures()

  if (!actions.canEditPurchaseOrders) return null
  if (!hasLicenseFeature(licenseFeatures, 'purchase_orders')) return null

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrowPurchaseOrders')}
        title={t('dashboard.purchaseOrders')}
        description={t('dashboard.purchaseOrdersDesc')}
        actions={
          <Button onClick={() => setPoOpen(true)}>
            <Plus className="size-4" />
            {t('forms.createPo')}
          </Button>
        }
      />

      <Card title={t('dashboard.purchaseOrders')} description={t('dashboard.purchaseOrdersDesc')}>
        {purchaseOrders.length === 0 ? (
          <EmptyState title={t('empty.noPos')} description={t('empty.noPosDesc')} />
        ) : (
          <Table
            embedded
            pageSize={10}
            rowKey={(row) => row.id}
            rows={purchaseOrders}
            onRowClick={(row) => onOpenPo(row.id)}
            search={{
              getText: (row) => `${row.poNumber} ${statusLabel(t, 'po', row.status)}`,
            }}
            filters={[
              {
                id: 'status',
                label: t('forms.status'),
                type: 'select',
                options: [
                  { value: 'draft', label: statusLabel(t, 'po', 'draft') },
                  { value: 'ordered', label: statusLabel(t, 'po', 'ordered') },
                  {
                    value: 'partially_received',
                    label: statusLabel(t, 'po', 'partially_received'),
                  },
                  { value: 'received', label: statusLabel(t, 'po', 'received') },
                  { value: 'cancelled', label: statusLabel(t, 'po', 'cancelled') },
                ],
                getValue: (row) => row.status,
              },
            ]}
            mobileCardTitle={(row) => row.poNumber}
            mobileCardSubtitle={(row) => statusLabel(t, 'po', row.status)}
            mobileCardFields={[
              { key: 'date', label: t('forms.orderDate'), render: (row) => row.orderDate },
            ]}
            columns={[
              {
                key: 'poNumber',
                header: t('forms.poNumber'),
                render: (row) => <span className="font-medium">{row.poNumber}</span>,
              },
              {
                key: 'status',
                header: t('forms.status'),
                width: 'w-40',
                render: (row) => (
                  <Badge tone={poStatusTone(row.status)}>{statusLabel(t, 'po', row.status)}</Badge>
                ),
              },
              {
                key: 'date',
                header: t('forms.orderDate'),
                width: 'w-36',
                render: (row) => row.orderDate,
              },
            ]}
          />
        )}
      </Card>

      <CreatePoModal
        open={poOpen}
        onClose={() => setPoOpen(false)}
        businessId={activeBusinessId}
        branchOptions={branchOptions}
        supplierOptions={supplierOptions}
        onCreated={async (poId) => {
          if (activeBusinessId) await refreshScopedData(activeBusinessId)
          onOpenPo(poId)
        }}
      />
    </div>
  )
}
