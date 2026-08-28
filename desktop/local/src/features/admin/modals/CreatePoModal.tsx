import { useEffect, useMemo, useState } from 'react'
import { Form, Formik } from 'formik'
import { Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import { Button, Modal, SelectField, TextField, useToast } from '../../../components/ui'
import { FormSelectField, FormTextField } from '../../../components/form'
import { poCreateSchema } from '../../../schemas/adminSchemas'
import type { SelectOption } from '../../../components/ui'
import type { SupplierProduct } from '../../../../shared/types/api'

type PoLine = {
  productId: string
  orderedQty: number
  unitCost: number
}

type Props = {
  open: boolean
  onClose: () => void
  businessId: string | null
  branchOptions: SelectOption[]
  supplierOptions: SelectOption[]
  initialSupplierId?: string | null
  initialBranchId?: string | null
  onCreated: (poId: string) => Promise<void>
}

export function CreatePoModal({
  open,
  onClose,
  businessId,
  branchOptions,
  supplierOptions,
  initialSupplierId,
  initialBranchId,
  onCreated,
}: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const [catalog, setCatalog] = useState<SupplierProduct[]>([])
  const [loadingCatalog, setLoadingCatalog] = useState(false)
  const [printAfter, setPrintAfter] = useState(true)

  async function loadCatalog(supplierId: string) {
    if (!supplierId) {
      setCatalog([])
      return
    }
    setLoadingCatalog(true)
    try {
      setCatalog(await window.api.suppliers.listProducts(supplierId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
      setCatalog([])
    } finally {
      setLoadingCatalog(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const supplierId = initialSupplierId || supplierOptions[0]?.value || ''
    if (supplierId) void loadCatalog(supplierId)
    else setCatalog([])
  }, [open, initialSupplierId])

  const catalogOptions = useMemo(
    () =>
      catalog.map((item) => ({
        value: item.productId,
        label: `${item.product.name} (${formatMoney(item.unitCost)})`,
      })),
    [catalog],
  )

  return (
    <Modal open={open} onClose={onClose} title={t('forms.createPo')} size="lg">
      <Formik
        enableReinitialize
        initialValues={{
          branchId: initialBranchId || branchOptions[0]?.value || '',
          supplierId: initialSupplierId || supplierOptions[0]?.value || '',
          poNumber: `PO-${Date.now().toString().slice(-6)}`,
          orderDate: new Date().toISOString().slice(0, 10),
          items: [] as PoLine[],
          addProductId: '',
        }}
        validationSchema={poCreateSchema}
        onSubmit={async (values, { setSubmitting }) => {
          if (!businessId) return
          try {
            const po = await window.api.purchaseOrders.create({
              businessId,
              branchId: values.branchId,
              supplierId: values.supplierId,
              poNumber: values.poNumber,
              orderDate: values.orderDate,
              items: values.items.map((item) => ({
                productId: item.productId,
                orderedQty: Number(item.orderedQty),
                unitCost: Number(item.unitCost),
              })),
            })
            toast.success(t('toast.poCreated'))
            if (printAfter) {
              try {
                await window.api.purchaseOrders.print(po.id)
              } catch (e) {
                toast.error(e instanceof Error ? e.message : t('toast.poPrintFailed'))
              }
            }
            await onCreated(po.id)
            onClose()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
          } finally {
            setSubmitting(false)
          }
        }}
      >
        {({ values, setFieldValue, isSubmitting, errors, touched }) => {
          const usedIds = new Set(values.items.map((i) => i.productId))
          const availableOptions = catalogOptions.filter((o) => !usedIds.has(o.value))
          const total = values.items.reduce(
            (sum, item) => sum + Number(item.orderedQty || 0) * Number(item.unitCost || 0),
            0,
          )

          return (
            <Form className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {branchOptions.length > 1 ? (
                  <FormSelectField name="branchId" label={t('forms.branch')} options={branchOptions} />
                ) : null}
                <SelectField
                  label={t('forms.supplier')}
                  value={values.supplierId}
                  options={supplierOptions}
                  error={touched.supplierId && errors.supplierId ? String(errors.supplierId) : undefined}
                  onChange={async (next) => {
                    await setFieldValue('supplierId', next)
                    await setFieldValue('items', [])
                    await setFieldValue('addProductId', '')
                    await loadCatalog(next)
                  }}
                />
                <FormTextField name="poNumber" label={t('forms.poNumber')} />
                <FormTextField name="orderDate" label={t('forms.orderDate')} type="date" />
              </div>

              <div className="space-y-2 rounded-lg border border-line p-3">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[200px] flex-1">
                    <SelectField
                      label={t('forms.addPoProduct')}
                      value={values.addProductId}
                      options={[{ value: '', label: t('forms.selectProduct') }, ...availableOptions]}
                      onChange={(v) => setFieldValue('addProductId', v)}
                      disabled={loadingCatalog || !values.supplierId}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={!values.addProductId}
                    onClick={() => {
                      const linked = catalog.find((c) => c.productId === values.addProductId)
                      if (!linked) return
                      void setFieldValue('items', [
                        ...values.items,
                        {
                          productId: linked.productId,
                          orderedQty: 1,
                          unitCost: linked.unitCost,
                        },
                      ])
                      void setFieldValue('addProductId', '')
                    }}
                  >
                    <Plus className="size-4" />
                    {t('common.add')}
                  </Button>
                </div>
                {loadingCatalog ? (
                  <p className="text-sm text-ink-muted">{t('common.loading')}</p>
                ) : catalog.length === 0 && values.supplierId ? (
                  <p className="text-sm text-ink-muted">{t('empty.noSupplierProductsDesc')}</p>
                ) : null}

                {values.items.length === 0 ? (
                  <p className="text-sm text-ink-muted">{t('forms.poItemsHint')}</p>
                ) : (
                  <div className="space-y-2">
                    {values.items.map((item, index) => {
                      const linked = catalog.find((c) => c.productId === item.productId)
                      return (
                        <div
                          key={item.productId}
                          className="rounded-lg border border-line px-2 py-2"
                        >
                          <div className="min-w-0 pb-2">
                            <p className="truncate text-sm font-medium text-ink">{linked?.product.name ?? item.productId}</p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                            <TextField
                              label={t('forms.qty')}
                              type="number"
                              min={0.01}
                              step="any"
                              value={item.orderedQty}
                              onChange={(e) =>
                                setFieldValue(`items.${index}.orderedQty`, Number(e.target.value))
                              }
                            />
                            <TextField
                              label={t('forms.unitCost')}
                              type="number"
                              min={0}
                              step="any"
                              value={item.unitCost}
                              onChange={(e) =>
                                setFieldValue(`items.${index}.unitCost`, Number(e.target.value))
                              }
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              className="sm:mb-0.5"
                              onClick={() =>
                                setFieldValue(
                                  'items',
                                  values.items.filter((_, i) => i !== index),
                                )
                              }
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    <p className="text-right text-sm font-semibold text-ink">
                      {t('forms.total')}: {formatMoney(total)}
                    </p>
                  </div>
                )}
                {touched.items && typeof errors.items === 'string' ? (
                  <p className="text-sm text-danger">{errors.items}</p>
                ) : null}
              </div>

              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={printAfter}
                  onChange={(e) => setPrintAfter(e.target.checked)}
                />
                {t('forms.printPoAfterCreate')}
              </label>

              <div className="flex flex-col-reverse justify-end gap-2 sm:flex-row">
                <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" loading={isSubmitting} disabled={values.items.length === 0}>
                  {t('forms.createPo')}
                </Button>
              </div>
            </Form>
          )
        }}
      </Formik>
    </Modal>
  )
}
