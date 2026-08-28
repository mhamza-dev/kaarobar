import { Eye, Link2, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
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
import { useActionVisibility } from '../../../lib/nav'
import { hasLicenseFeature, useLicenseFeatures } from '../../../lib/license'
import { AssetImage } from '../../../components/ui'
import { ProductFormModal } from '../modals/ProductFormModal'
import { ProductSuppliersModal } from '../modals/ProductSuppliersModal'
import { RowActionsMenu } from '../components/RowActionsMenu'
import { normalizeBusinessNature } from '../../../lib/businessNature'
import type { Product, SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
}

export function ProductsPage({ user, data }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'create' | 'edit' | 'view'>('create')
  const [selected, setSelected] = useState<Product | null>(null)
  const [suppliersOpen, setSuppliersOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const { products, suppliers, businesses, activeBusinessId, refreshScopedData } = data
  const business = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null
  const businessNature = normalizeBusinessNature(business?.businessNature)
  const suppliersEnabled = hasLicenseFeature(useLicenseFeatures(), 'suppliers')
  const productActions = (row: Product) => [
    {
      id: 'open',
      label: actions.canEditProducts ? t('common.edit') : t('common.view'),
      icon: actions.canEditProducts ? <Pencil className="size-4" /> : <Eye className="size-4" />,
      onSelect: () => {
        setSelected(row)
        setMode(actions.canEditProducts ? 'edit' : 'view')
        setOpen(true)
      },
    },
    ...(actions.canEditProducts && suppliersEnabled
      ? [
          {
            id: 'suppliers',
            label: t('forms.productSuppliers'),
            icon: <Link2 className="size-4" />,
            onSelect: () => {
              setSelected(row)
              setSuppliersOpen(true)
            },
          },
        ]
      : []),
    ...(actions.canEditProducts
      ? [
          {
            id: 'toggle',
            label: row.isActive ? t('common.deactivate') : t('common.activate'),
            icon: <Power className="size-4" />,
            danger: row.isActive,
            onSelect: async () => {
              try {
                await window.api.products.setActive({
                  id: row.id,
                  isActive: !row.isActive,
                })
                if (activeBusinessId) await refreshScopedData(activeBusinessId)
                toast.success(row.isActive ? t('toast.productDeactivated') : t('toast.productActivated'))
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
              }
            },
          },
          {
            id: 'delete',
            label: t('common.delete'),
            icon: <Trash2 className="size-4" />,
            danger: true,
            onSelect: () => setDeleteTarget(row),
          },
        ]
      : []),
  ]

  if (!actions.canViewProducts) return null

  const lowStock = products.filter((p) => p.isActive && p.tracksStock && p.stockQty <= 5).length
  const inactive = products.filter((p) => !p.isActive).length

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrowCatalog')}
        title={t('dashboard.products')}
        description={t('dashboard.productsDesc')}
        actions={
          actions.canEditProducts ? (
            <Button
              onClick={() => {
                setSelected(null)
                setMode('create')
                setOpen(true)
              }}
            >
              <Plus className="size-4" />
              {t('forms.addProduct')}
            </Button>
          ) : null
        }
      />

      {products.length > 0 ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface-raised px-4 py-3 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{t('dashboard.statTotal', { count: products.length })}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-raised px-4 py-3 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-warning">{t('dashboard.statLowStock', { count: lowStock })}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-raised px-4 py-3 shadow-soft">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('dashboard.statInactive', { count: inactive })}</p>
          </div>
        </div>
      ) : null}

      <Card title={t('dashboard.productCatalog')} description={t('dashboard.productsDesc')}>
        {products.length === 0 ? (
          <EmptyState title={t('empty.noProducts')} description={t('empty.noProductsDesc')} />
        ) : (
          <Table
            embedded
            pageSize={10}
            rowKey={(row) => row.id}
            rows={products}
            search={{
              getText: (row) => `${row.name} ${row.barcode ?? ''}`,
            }}
            filters={[
              {
                id: 'active',
                label: t('forms.status'),
                type: 'boolean',
                getValue: (row) => row.isActive,
              },
              {
                id: 'stock',
                label: t('table.stockLevel'),
                type: 'select',
                options: [
                  { value: 'in', label: t('table.stockIn') },
                  { value: 'low', label: t('table.stockLow') },
                  { value: 'out', label: t('table.stockOut') },
                ],
                getValue: (row) =>
                  !row.tracksStock ? 'in' : row.stockQty <= 0 ? 'out' : row.stockQty <= 5 ? 'low' : 'in',
              },
              {
                id: 'price',
                label: t('table.priceRange'),
                type: 'numberRange',
                getValue: (row) => row.price,
              },
              {
                id: 'barcode',
                label: t('table.barcode'),
                type: 'select',
                options: [
                  { value: 'has', label: t('table.barcodeHas') },
                  { value: 'missing', label: t('table.barcodeMissing') },
                ],
                getValue: (row) => (row.barcode ? 'has' : 'missing'),
              },
            ]}
            mobileCardTitle={(row) => row.name}
            mobileCardSubtitle={(row) => formatMoney(row.price)}
            mobileCardFields={[
              { key: 'barcode', label: t('forms.barcode'), render: (row) => row.barcode ?? '—' },
              { key: 'stock', label: t('forms.stock'), render: (row) => (row.tracksStock ? row.stockQty : '—') },
              {
                key: 'status',
                label: t('forms.status'),
                render: (row) => (
                  <Badge tone={row.isActive ? 'success' : 'neutral'}>
                    {row.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                ),
              },
            ]}
            mobileCardActions={(row) => <RowActionsMenu actions={productActions(row)} />}
            columns={[
              {
                key: 'name',
                header: t('forms.name'),
                render: (row) => (
                  <div className="flex min-w-0 items-center gap-2">
                    {row.imagePath ? (
                      <AssetImage
                        path={row.imagePath}
                        className="size-8 shrink-0 rounded-lg border border-line object-cover"
                      />
                    ) : null}
                    <span className="truncate font-medium">{row.name}</span>
                  </div>
                ),
              },
              { key: 'barcode', header: t('forms.barcode'), render: (row) => row.barcode ?? '—' },
              { key: 'price', header: t('forms.price'), render: (row) => formatMoney(row.price) },
              { key: 'stock', header: t('forms.stock'), width: 'w-24', render: (row) => (row.tracksStock ? row.stockQty : '—') },
              {
                key: 'status',
                header: t('forms.status'),
                width: 'w-28',
                render: (row) => (
                  <Badge tone={row.isActive ? 'success' : 'neutral'}>
                    {row.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                ),
              },
              {
                key: 'actions',
                header: <span className="sr-only">{t('forms.actions')}</span>,
                width: 'w-36',
                align: 'end',
                render: (row) => <RowActionsMenu actions={productActions(row)} />,
              },
            ]}
          />
        )}
      </Card>

      <ProductFormModal
        open={open}
        onClose={() => setOpen(false)}
        mode={mode}
        initial={selected}
        products={products}
        businessId={activeBusinessId}
        businessNature={businessNature}
        canEdit={actions.canEditProducts}
        onLoadExisting={(product) => {
          setSelected(product)
          setMode(actions.canEditProducts ? 'edit' : 'view')
        }}
        onSubmit={async (values) => {
          if (!activeBusinessId) return
          try {
            if (selected && mode === 'edit') {
              await window.api.products.update({
                id: selected.id,
                name: values.name,
                barcode: values.barcode || null,
                price: Number(values.price),
                costPrice: values.costPrice == null ? null : Number(values.costPrice),
                stockQty: Number(values.stockQty),
                kind: values.kind,
                tracksStock: values.tracksStock,
                imagePath: values.imagePath,
                isActive: selected.isActive,
              })
              toast.success(t('toast.productUpdated'))
            } else {
              await window.api.products.create({
                businessId: activeBusinessId,
                branchId: null,
                name: values.name,
                barcode: values.barcode || undefined,
                price: Number(values.price),
                costPrice: values.costPrice == null ? undefined : Number(values.costPrice),
                stockQty: Number(values.stockQty),
                kind: values.kind,
                tracksStock: values.tracksStock,
                imagePath: values.imagePath,
              })
              toast.success(t('toast.productCreated'))
            }
            await refreshScopedData(activeBusinessId)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
            throw e
          }
        }}
      />

      <ProductSuppliersModal
        open={suppliersOpen}
        onClose={() => setSuppliersOpen(false)}
        product={selected}
        suppliers={suppliers}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('forms.deleteProduct')}
        description={t('forms.deleteProductConfirm', { name: deleteTarget?.name ?? '' })}
        danger
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            const result = await window.api.products.delete(deleteTarget.id)
            toast.success(
              result.mode === 'deactivated'
                ? t('toast.productSoftDeleted')
                : t('toast.productDeleted'),
            )
            if (activeBusinessId) await refreshScopedData(activeBusinessId)
            setDeleteTarget(null)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
          }
        }}
      />
    </div>
  )
}
