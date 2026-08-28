import { useState } from 'react'
import { Form, Formik } from 'formik'
import { Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  Table,
  useToast } from '../../../components/ui'
import { FormTextField, FormTextareaField } from '../../../components/form'
import { PageHeader } from '../../../components/layout'
import { supplierCreateSchema } from '../../../schemas/adminSchemas'
import { useActionVisibility } from '../../../lib/nav'
import { hasLicenseFeature, useLicenseFeatures } from '../../../lib/license'
import { RowActionsMenu } from '../components/RowActionsMenu'
import type { SessionUser, Supplier } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
  onOpenSupplier: (id: string) => void
}

export function SuppliersPage({ user, data, onOpenSupplier }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const { suppliers, activeBusinessId, refreshScopedData } = data
  const licenseFeatures = useLicenseFeatures()

  if (!actions.canEditSuppliers) return null
  if (!hasLicenseFeature(licenseFeatures, 'suppliers')) return null

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrowSuppliers')}
        title={t('dashboard.suppliers')}
        description={t('dashboard.suppliersDesc')}
        actions={
          <Button
            onClick={() => {
              setEditing(null)
              setSupplierOpen(true)
            }}
          >
            <Plus className="size-4" />
            {t('forms.addSupplier')}
          </Button>
        }
      />

      <Card title={t('dashboard.suppliers')} description={t('dashboard.suppliersDesc')}>
        {suppliers.length === 0 ? (
          <EmptyState title={t('empty.noSuppliers')} description={t('empty.noSuppliersDesc')} />
        ) : (
          <Table
            embedded
            pageSize={10}
            rowKey={(row) => row.id}
            rows={suppliers}
            onRowClick={(row) => onOpenSupplier(row.id)}
            search={{
              getText: (row) => `${row.name} ${row.phone ?? ''}` }}
            filters={[
              {
                id: 'active',
                label: t('forms.status'),
                type: 'boolean',
                getValue: (row) => row.isActive },
            ]}
            mobileCardTitle={(row) => row.name}
            mobileCardSubtitle={(row) => row.phone ?? '—'}
            mobileCardFields={[
              { key: 'notes', label: t('forms.notes'), render: (row) => row.notes ?? '—' },
              {
                key: 'status',
                label: t('forms.status'),
                render: (row) => (
                  <Badge tone={row.isActive ? 'success' : 'neutral'}>
                    {row.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                ) },
            ]}
            mobileCardActions={(row) => (
              <RowActionsMenu
                actions={[
                  {
                    id: 'edit',
                    label: t('common.edit'),
                    icon: <Pencil className="size-4" />,
                    onSelect: () => {
                      setEditing(row)
                      setSupplierOpen(true)
                    } },
                ]}
              />
            )}
            columns={[
              {
                key: 'name',
                header: t('forms.supplier'),
                render: (row) => <span className="font-medium">{row.name}</span> },
              { key: 'phone', header: t('forms.phone'), render: (row) => row.phone ?? '—' },
              { key: 'notes', header: t('forms.notes'), render: (row) => row.notes ?? '—' },
              {
                key: 'status',
                header: t('forms.status'),
                width: 'w-28',
                render: (row) => (
                  <Badge tone={row.isActive ? 'success' : 'neutral'}>
                    {row.isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                ) },
              {
                key: 'actions',
                header: <span className="sr-only">{t('forms.actions')}</span>,
                width: 'w-28',
                align: 'end',
                render: (row) => (
                  <RowActionsMenu
                    actions={[
                      {
                        id: 'edit',
                        label: t('common.edit'),
                        icon: <Pencil className="size-4" />,
                        onSelect: () => {
                          setEditing(row)
                          setSupplierOpen(true)
                        } },
                    ]}
                  />
                ) },
            ]}
          />
        )}
      </Card>

      <Modal
        open={supplierOpen}
        onClose={() => setSupplierOpen(false)}
        title={editing ? t('forms.editSupplier') : t('forms.createSupplier')}
      >
        <Formik
          enableReinitialize
          initialValues={{
            name: editing?.name ?? '',
            phone: editing?.phone ?? '',
            address: editing?.address ?? '',
            notes: editing?.notes ?? '' }}
          validationSchema={supplierCreateSchema}
          onSubmit={async (values) => {
            if (!activeBusinessId) return
            try {
              if (editing) {
                await window.api.suppliers.update({ id: editing.id, ...values })
                toast.success(t('toast.supplierUpdated'))
              } else {
                await window.api.suppliers.create({ businessId: activeBusinessId, ...values })
                toast.success(t('toast.supplierCreated'))
              }
              await refreshScopedData(activeBusinessId)
              setSupplierOpen(false)
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
                <Button type="button" variant="secondary" onClick={() => setSupplierOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  {t('common.save')}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </Modal>
    </div>
  )
}
