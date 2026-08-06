import { useEffect, useMemo, useState } from 'react'
import { Form, Formik } from 'formik'
import { ArrowLeft, Pencil, Plus, Power, Trash2, Unlink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Modal,
  SelectField,
  Table,
  useToast } from '../../../components/ui'
import { FormTextField, FormTextareaField } from '../../../components/form'
import { PageHeader } from '../../../components/layout'
import { supplierCreateSchema, supplierLinkSchema } from '../../../schemas/adminSchemas'
import { useActionVisibility } from '../../../lib/nav'
import { normalizeBusinessNature } from '../../../lib/businessNature'
import { CreatePoModal } from '../modals/CreatePoModal'
import { ProductFormModal } from '../modals/ProductFormModal'
import { RowActionsMenu } from '../components/RowActionsMenu'
import type {
  SessionUser,
  SupplierDetail,
  SupplierProduct } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
  supplierId: string
  onBack: () => void
  onOpenPo: (poId: string) => void
}

export function SupplierDetailPage({ user, data, supplierId, onBack, onOpenPo }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const [detail, setDetail] = useState<SupplierDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [attachOpen, setAttachOpen] = useState(false)
  const [createAttachOpen, setCreateAttachOpen] = useState(false)
  const [poOpen, setPoOpen] = useState(false)
  const [costEdit, setCostEdit] = useState<SupplierProduct | null>(null)
  const [unlinkTarget, setUnlinkTarget] = useState<SupplierProduct | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SupplierProduct | null>(null)
  const { products, businesses, branchOptions, supplierOptions, activeBusinessId, refreshScopedData } =
    data
  const business = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null
  const businessNature = normalizeBusinessNature(business?.businessNature)
  const supplierProductActions = (row: SupplierProduct) => [
    {
      id: 'cost',
      label: t('forms.editUnitCost'),
      icon: <Pencil className="size-4" />,
      onSelect: () => setCostEdit(row) },
    {
      id: 'toggle',
      label: row.product.isActive ? t('common.deactivate') : t('common.activate'),
      icon: <Power className="size-4" />,
      danger: row.product.isActive,
      onSelect: async () => {
        try {
          await window.api.products.setActive({
            id: row.productId,
            isActive: !row.product.isActive })
          if (activeBusinessId) await refreshScopedData(activeBusinessId)
          await load()
          toast.success(row.product.isActive ? t('toast.productDeactivated') : t('toast.productActivated'))
        } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
        }
      } },
    {
      id: 'unlink',
      label: t('forms.removeFromSupplier'),
      icon: <Unlink className="size-4" />,
      onSelect: () => setUnlinkTarget(row) },
    {
      id: 'delete',
      label: t('common.delete'),
      icon: <Trash2 className="size-4" />,
      danger: true,
      onSelect: () => setDeleteTarget(row) },
  ]

  async function load() {
    setLoading(true)
    try {
      setDetail(await window.api.suppliers.getDetail(supplierId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
      setDetail(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [supplierId])

  const attachableProducts = useMemo(() => {
    const linked = new Set((detail?.products ?? []).map((p) => p.productId))
    return products
      .filter((p) => !linked.has(p.id))
      .map((p) => ({
        value: p.id,
        label: `${p.name}${p.barcode ? ` (${p.barcode})` : ''}` }))
  }, [products, detail])

  if (!actions.canEditSuppliers) return null

  const supplier = detail?.supplier

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
        title={supplier?.name ?? t('forms.supplierDetail')}
        description={
          loading
            ? t('common.loading')
            : [supplier?.phone, supplier?.address].filter(Boolean).join(' · ') ||
              t('dashboard.supplierDetailDesc')
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setEditOpen(true)
              }}
            >
              <Pencil className="size-4" />
              {t('common.edit')}
            </Button>
            <Button onClick={() => setPoOpen(true)}>
              <Plus className="size-4" />
              {t('forms.createPo')}
            </Button>
          </div>
        }
      />

      {supplier ? (
        <div className="mb-6 overflow-hidden rounded-lg border border-brand-primary/15 bg-gradient-to-br from-brand-tint/70 via-surface-raised to-surface-raised p-5 shadow-soft">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-primary">{t('forms.supplier')}</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-ink">{supplier.name}</h3>
              <p className="mt-1 text-sm text-ink-muted">
                {[supplier.phone, supplier.address].filter(Boolean).join(' · ') || '—'}
              </p>
              {supplier.notes ? <p className="mt-2 text-sm text-ink-muted">{supplier.notes}</p> : null}
            </div>
            <Badge tone={supplier.isActive ? 'success' : 'neutral'}>
              {supplier.isActive ? t('common.active') : t('common.inactive')}
            </Badge>
          </div>
        </div>
      ) : null}

      <Card
        title={t('dashboard.supplierProducts')}
        description={t('dashboard.supplierProductsDesc')}
        className="mb-6"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAttachOpen(true)}>
              <Plus className="size-4" />
              {t('forms.attachProduct')}
            </Button>
            {actions.canEditProducts ? (
              <Button onClick={() => setCreateAttachOpen(true)}>
                <Plus className="size-4" />
                {t('forms.createAndAttach')}
              </Button>
            ) : null}
          </div>
        }
      >
        {!detail || detail.products.length === 0 ? (
          <EmptyState
            title={t('empty.noSupplierProducts')}
            description={t('empty.noSupplierProductsDesc')}
          />
        ) : (
          <Table
            embedded
            pageSize={10}
            rowKey={(row) => row.linkId}
            rows={detail.products}
            search={{
              getText: (row) => `${row.product.name} ${row.product.barcode ?? ''}` }}
            filters={[
              {
                id: 'active',
                label: t('forms.status'),
                type: 'boolean',
                getValue: (row) => row.product.isActive },
              {
                id: 'unitCost',
                label: t('table.unitCostRange'),
                type: 'numberRange',
                getValue: (row) => row.unitCost },
            ]}
            mobileCardTitle={(row) => row.product.name}
            mobileCardSubtitle={(row) => formatMoney(row.product.price)}
            mobileCardFields={[
              { key: 'barcode', label: t('forms.barcode'), render: (row) => row.product.barcode ?? '—' },
              { key: 'unitCost', label: t('forms.unitCost'), render: (row) => formatMoney(row.unitCost) },
              {
                key: 'status',
                label: t('forms.status'),
                render: (row) => (
                  <Badge tone={row.product.isActive ? 'success' : 'neutral'}>
                    {row.product.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                ) },
            ]}
            mobileCardActions={(row) => <RowActionsMenu actions={supplierProductActions(row)} />}
            columns={[
              { key: 'name', header: t('forms.name'), render: (row) => <span className="font-medium">{row.product.name}</span> },
              {
                key: 'barcode',
                header: t('forms.barcode'),
                render: (row) => row.product.barcode ?? '—' },
              {
                key: 'price',
                header: t('forms.price'),
                render: (row) => formatMoney(row.product.price) },
              {
                key: 'unitCost',
                header: t('forms.unitCost'),
                render: (row) => formatMoney(row.unitCost) },
              {
                key: 'status',
                header: t('forms.status'),
                width: 'w-28',
                render: (row) => (
                  <Badge tone={row.product.isActive ? 'success' : 'neutral'}>
                    {row.product.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                ) },
              {
                key: 'actions',
                header: <span className="sr-only">{t('forms.actions')}</span>,
                width: 'w-40',
                align: 'end',
                render: (row) => <RowActionsMenu actions={supplierProductActions(row)} /> },
            ]}
          />
        )}
      </Card>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={t('forms.editSupplier')}>
        {supplier ? (
          <Formik
            enableReinitialize
            initialValues={{
              name: supplier.name,
              phone: supplier.phone ?? '',
              address: supplier.address ?? '',
              notes: supplier.notes ?? '' }}
            validationSchema={supplierCreateSchema}
            onSubmit={async (values) => {
              try {
                await window.api.suppliers.update({ id: supplier.id, ...values })
                toast.success(t('toast.supplierUpdated'))
                if (activeBusinessId) await refreshScopedData(activeBusinessId)
                await load()
                setEditOpen(false)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-3">
                <FormTextField name="name" label={t('forms.name')} />
                <FormTextField name="phone" label={t('forms.phone')} />
                <FormTextField name="address" label={t('forms.address')} />
                <FormTextareaField name="notes" label={t('forms.notes')} rows={2} />
                <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                  <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" loading={isSubmitting}>
                    {t('common.save')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        ) : null}
      </Modal>

      <Modal open={attachOpen} onClose={() => setAttachOpen(false)} title={t('forms.attachProduct')}>
        <Formik
          enableReinitialize
          initialValues={{
            productId: attachableProducts[0]?.value ?? '',
            unitCost:
              products.find((p) => p.id === attachableProducts[0]?.value)?.costPrice ?? 0 }}
          validationSchema={supplierLinkSchema}
          onSubmit={async (values) => {
            try {
              const product = products.find((p) => p.id === values.productId)
              await window.api.suppliers.linkProduct({
                supplierId,
                productId: values.productId,
                unitCost: Number(values.unitCost) })
              toast.success(t('toast.productAttached', { name: product?.name ?? '' }))
              await load()
              setAttachOpen(false)
            } catch (e) {
              toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
            }
          }}
        >
          {({ isSubmitting, values, setFieldValue, touched, errors }) => (
            <Form className="space-y-3">
              <SelectField
                label={t('forms.product')}
                value={values.productId}
                options={attachableProducts}
                error={touched.productId && errors.productId ? String(errors.productId) : undefined}
                onChange={(next) => {
                  void setFieldValue('productId', next)
                  const product = products.find((p) => p.id === next)
                  void setFieldValue('unitCost', product?.costPrice ?? 0)
                }}
              />
              <FormTextField name="unitCost" label={t('forms.unitCost')} type="number" />
              <p className="text-xs text-ink-muted">{t('forms.attachProductHint')}</p>
              <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <Button type="button" variant="secondary" onClick={() => setAttachOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={isSubmitting} disabled={attachableProducts.length === 0}>
                  {t('forms.attachProduct')}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </Modal>

      <ProductFormModal
        open={createAttachOpen}
        onClose={() => setCreateAttachOpen(false)}
        mode="create"
        initial={null}
        products={products}
        businessId={activeBusinessId}
        businessNature={businessNature}
        canEdit={actions.canEditProducts}
        onLoadExisting={() => undefined}
        onSubmit={async (values) => {
          if (!activeBusinessId) return
          try {
            const product = await window.api.products.create({
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
            await window.api.suppliers.linkProduct({
              supplierId,
              productId: product.id,
              unitCost: Number(values.costPrice ?? 0),
            })
            toast.success(t('toast.productCreatedAndAttached', { name: product.name }))
            await refreshScopedData(activeBusinessId)
            await load()
            setCreateAttachOpen(false)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
            throw e
          }
        }}
      />

      <Modal open={!!costEdit} onClose={() => setCostEdit(null)} title={t('forms.editUnitCost')}>
        {costEdit ? (
          <Formik
            initialValues={{ unitCost: costEdit.unitCost }}
            validationSchema={supplierLinkSchema.pick(['unitCost'])}
            onSubmit={async (values) => {
              try {
                await window.api.suppliers.updateLinkedProduct({
                  supplierId,
                  productId: costEdit.productId,
                  unitCost: Number(values.unitCost) })
                toast.success(t('toast.unitCostUpdated'))
                await load()
                setCostEdit(null)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
              }
            }}
          >
            {({ isSubmitting }) => (
              <Form className="space-y-3">
                <p className="text-sm text-ink">{costEdit.product.name}</p>
                <FormTextField name="unitCost" label={t('forms.unitCost')} type="number" />
                <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                  <Button type="button" variant="secondary" onClick={() => setCostEdit(null)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" loading={isSubmitting}>
                    {t('common.save')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!unlinkTarget}
        onClose={() => setUnlinkTarget(null)}
        title={t('forms.removeFromSupplier')}
        description={t('forms.removeFromSupplierConfirm', {
          product: unlinkTarget?.product.name ?? '',
          supplier: supplier?.name ?? '' })}
        confirmLabel={t('forms.removeFromSupplier')}
        onConfirm={async () => {
          if (!unlinkTarget) return
          try {
            await window.api.suppliers.unlinkProduct({
              supplierId,
              productId: unlinkTarget.productId })
            toast.success(t('toast.productDetached'))
            await load()
            setUnlinkTarget(null)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
          }
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title={t('forms.deleteProduct')}
        description={t('forms.deleteProductConfirm', { name: deleteTarget?.product.name ?? '' })}
        danger
        confirmLabel={t('common.delete')}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            const result = await window.api.products.delete(deleteTarget.productId)
            toast.success(
              result.mode === 'deactivated'
                ? t('toast.productSoftDeleted')
                : t('toast.productDeleted'),
            )
            if (activeBusinessId) await refreshScopedData(activeBusinessId)
            await load()
            setDeleteTarget(null)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
          }
        }}
      />

      <CreatePoModal
        open={poOpen}
        onClose={() => setPoOpen(false)}
        businessId={activeBusinessId}
        branchOptions={branchOptions}
        supplierOptions={supplierOptions}
        initialSupplierId={supplierId}
        onCreated={async (poId) => {
          if (activeBusinessId) await refreshScopedData(activeBusinessId)
          onOpenPo(poId)
        }}
      />
    </div>
  )
}
