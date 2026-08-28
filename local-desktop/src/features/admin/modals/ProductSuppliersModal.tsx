import { Form, Formik } from 'formik'
import { useEffect, useMemo, useState } from 'react'
import { Unlink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import * as yup from 'yup'
import { Button, Modal, SelectField, Table, useToast } from '../../../components/ui'
import { FormTextField } from '../../../components/form'
import type { Product, ProductSupplierLink, Supplier } from '../../../../shared/types/api'

const attachSchema = yup.object({
  supplierId: yup.string().required('Supplier is required'),
  unitCost: yup
    .number()
    .typeError('Enter a valid unit cost')
    .min(0, 'Unit cost must be >= 0')
    .required('Unit cost is required'),
})

type Props = {
  open: boolean
  onClose: () => void
  product: Product | null
  suppliers: Supplier[]
}

export function ProductSuppliersModal({ open, onClose, product, suppliers }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const [links, setLinks] = useState<ProductSupplierLink[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    if (!product) return
    setLoading(true)
    try {
      setLinks(await window.api.products.listSuppliers(product.id))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
      setLinks([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && product) void load()
  }, [open, product?.id])

  const attachable = useMemo(() => {
    const linked = new Set(links.map((l) => l.supplierId))
    return suppliers
      .filter((s) => s.isActive && !linked.has(s.id))
      .map((s) => ({ value: s.id, label: s.name }))
  }, [suppliers, links])

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('forms.productSuppliers')}
      description={product?.name}
      size="lg"
    >
      <div className="space-y-4">
        {loading ? <p className="text-sm text-ink-muted">{t('common.loading')}</p> : null}

        {links.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('forms.productNoSuppliers')}</p>
        ) : (
          <Table
            embedded
            pageSize={8}
            rowKey={(row) => row.linkId}
            rows={links}
            mobileCardTitle={(row) => row.supplierName}
            mobileCardSubtitle={(row) => formatMoney(row.unitCost)}
            mobileCardActions={(row) => (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={t('forms.removeFromSupplier')}
                onClick={async () => {
                  if (!product) return
                  try {
                    await window.api.suppliers.unlinkProduct({
                      supplierId: row.supplierId,
                      productId: product.id,
                    })
                    toast.success(t('toast.productDetached'))
                    await load()
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
                  }
                }}
              >
                <Unlink className="size-4" />
              </Button>
            )}
            columns={[
              { key: 'name', header: t('forms.supplier'), render: (row) => row.supplierName },
              {
                key: 'cost',
                header: t('forms.unitCost'),
                render: (row) => formatMoney(row.unitCost),
              },
              {
                key: 'actions',
                header: t('forms.actions'),
                align: 'end',
                width: 'w-28',
                render: (row) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={async () => {
                      if (!product) return
                      try {
                        await window.api.suppliers.unlinkProduct({
                          supplierId: row.supplierId,
                          productId: product.id,
                        })
                        toast.success(t('toast.productDetached'))
                        await load()
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
                      }
                    }}
                  >
                    {t('forms.removeFromSupplier')}
                  </Button>
                ),
              },
            ]}
          />
        )}

        <Formik
          enableReinitialize
          initialValues={{
            supplierId: attachable[0]?.value ?? '',
            unitCost: product?.costPrice ?? 0,
          }}
          validationSchema={attachSchema}
          onSubmit={async (values, { resetForm }) => {
            if (!product) return
            try {
              await window.api.suppliers.linkProduct({
                supplierId: values.supplierId,
                productId: product.id,
                unitCost: Number(values.unitCost),
              })
              toast.success(t('toast.productAttached', { name: product.name }))
              await load()
              resetForm()
            } catch (e) {
              toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
            }
          }}
        >
          {({ isSubmitting, values, setFieldValue, touched, errors }) => (
            <Form className="space-y-3 rounded-lg border border-line p-3">
              <p className="text-sm font-medium text-ink">{t('forms.attachToSupplier')}</p>
              <SelectField
                label={t('forms.supplier')}
                value={values.supplierId}
                options={attachable}
                error={touched.supplierId && errors.supplierId ? String(errors.supplierId) : undefined}
                onChange={(v) => setFieldValue('supplierId', v)}
                disabled={attachable.length === 0}
              />
              <FormTextField name="unitCost" label={t('forms.unitCost')} type="number" />
              <div className="flex justify-end">
                <Button type="submit" loading={isSubmitting} disabled={attachable.length === 0}>
                  {t('forms.attachProduct')}
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      </div>
    </Modal>
  )
}
