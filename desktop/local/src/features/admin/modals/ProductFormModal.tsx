import { Form, Formik, type FormikHelpers } from 'formik'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Modal, SelectField, useToast } from '../../../components/ui'
import { FormTextField } from '../../../components/form'
import { productCreateSchema } from '../../../schemas/adminSchemas'
import { BarcodePreview, printBarcodeLabel } from '../components/BarcodePreview'
import { ActivityTimeline } from '../components/ActivityTimeline'
import { useBarcodeScanner } from '../../pos/useBarcodeScanner'
import { assetSrc } from '../../../lib/assets'
import {
  defaultTracksStock,
  kindsForNature,
  showsKindSelector,
  type BusinessNature,
  type ProductKind,
} from '../../../lib/businessNature'
import type { ActivityEntry, Product } from '../../../../shared/types/api'

export type ProductFormValues = {
  name: string
  barcode: string
  price: number
  costPrice: number | null
  stockQty: number
  kind: ProductKind
  tracksStock: boolean
  imagePath: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  mode: 'create' | 'edit' | 'view'
  initial?: Product | null
  products: Product[]
  businessId: string | null
  businessNature: BusinessNature
  canEdit: boolean
  onSubmit: (values: ProductFormValues) => Promise<void>
  onLoadExisting: (product: Product) => void
}

export function ProductFormModal({
  open,
  onClose,
  mode,
  initial,
  products,
  businessId,
  businessNature,
  canEdit,
  onSubmit,
  onLoadExisting,
}: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const setBarcodeRef = useRef<((code: string) => void) | null>(null)
  const productsRef = useRef(products)
  const initialRef = useRef(initial)
  const onLoadExistingRef = useRef(onLoadExisting)
  const readOnly = mode === 'view' || !canEdit
  const allowedKinds = kindsForNature(businessNature)

  productsRef.current = products
  initialRef.current = initial
  onLoadExistingRef.current = onLoadExisting

  useEffect(() => {
    if (!open || !initial?.id) {
      setActivity([])
      return
    }
    window.api.products.getActivity(initial.id).then(setActivity).catch(() => setActivity([]))
  }, [open, initial?.id])

  useBarcodeScanner({
    enabled: open && !readOnly,
    onScan: (code) => {
      const active = document.activeElement
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        const name = active.getAttribute('name')
        if (name && name !== 'barcode') return
      }

      setBarcodeRef.current?.(code)
      const current = initialRef.current
      const match = productsRef.current.find(
        (p) => p.barcode === code && (!current?.id || p.id !== current.id),
      )
      if (match) {
        toast.success(t('toast.productLoadedFromScan'))
        onLoadExistingRef.current(match)
      }
    },
  })

  const title =
    mode === 'create'
      ? t('forms.createProduct')
      : mode === 'edit'
        ? t('forms.editProduct')
        : t('forms.viewProduct')

  const defaultKind = allowedKinds[0] ?? 'item'

  return (
    <Modal open={open} onClose={onClose} title={title} size="lg">
      <Formik<ProductFormValues>
        enableReinitialize
        initialValues={{
          name: initial?.name ?? '',
          barcode: initial?.barcode ?? '',
          price: initial?.price ?? 0,
          costPrice: initial?.costPrice ?? null,
          stockQty: initial?.stockQty ?? 0,
          kind: initial?.kind && allowedKinds.includes(initial.kind) ? initial.kind : defaultKind,
          tracksStock:
            initial?.tracksStock ??
            defaultTracksStock(
              initial?.kind && allowedKinds.includes(initial.kind) ? initial.kind : defaultKind,
            ),
          imagePath: initial?.imagePath ?? null,
        }}
        validationSchema={productCreateSchema}
        onSubmit={async (values, helpers: FormikHelpers<ProductFormValues>) => {
          if (readOnly) return
          await onSubmit(values)
          helpers.setSubmitting(false)
          onClose()
        }}
      >
        {({ values, setFieldValue, isSubmitting }) => {
          setBarcodeRef.current = (code: string) => setFieldValue('barcode', code)
          return (
            <Form className="space-y-3">
              <FormTextField name="name" label={t('forms.name')} disabled={readOnly} />
              {showsKindSelector(businessNature) ? (
                <SelectField
                  label={t('forms.productKind')}
                  disabled={readOnly}
                  value={values.kind}
                  options={allowedKinds.map((kind) => ({
                    value: kind,
                    label: t(`productKinds.${kind}`),
                  }))}
                  onChange={(kindValue) => {
                    const kind = kindValue as ProductKind
                    setFieldValue('kind', kind)
                    setFieldValue('tracksStock', defaultTracksStock(kind))
                    if (!defaultTracksStock(kind)) setFieldValue('stockQty', 0)
                  }}
                />
              ) : null}
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <FormTextField name="barcode" label={t('forms.barcode')} disabled={readOnly} />
                </div>
                {!readOnly && businessId ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={async () => {
                      const res = await window.api.products.generateBarcode(businessId)
                      setFieldValue('barcode', res.barcode)
                    }}
                  >
                    {t('barcode.generate')}
                  </Button>
                ) : null}
                {values.barcode ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => printBarcodeLabel(values.name || 'Product', values.barcode)}
                  >
                    {t('barcode.print')}
                  </Button>
                ) : null}
              </div>
              {!readOnly ? <p className="text-xs text-ink-muted">{t('forms.scanBarcodeHint')}</p> : null}
              {values.barcode ? (
                <div className="rounded-lg border border-line/60 bg-surface-muted/30 p-3 backdrop-blur-sm">
                  <BarcodePreview value={values.barcode} className="mx-auto" />
                </div>
              ) : null}

              <div className="space-y-2">
                <p className="text-sm font-medium text-ink">{t('forms.productImage')}</p>
                {values.imagePath ? (
                  <img
                    src={assetSrc(values.imagePath) ?? undefined}
                    alt=""
                    className="h-20 w-20 rounded-lg border border-line object-cover bg-surface-muted"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <p className="text-sm text-ink-muted">{t('forms.noImage')}</p>
                )}
                {!readOnly ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={async () => {
                        const picked = await window.api.assets.pickAndSave({ kind: 'product' })
                        if (picked) setFieldValue('imagePath', picked.relativePath)
                      }}
                    >
                      {t('forms.chooseImage')}
                    </Button>
                    {values.imagePath ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setFieldValue('imagePath', null)}
                      >
                        {t('forms.removeImage')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className={`grid gap-3 ${values.tracksStock ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <FormTextField name="price" label={t('forms.price')} type="number" disabled={readOnly} />
                <FormTextField
                  name="costPrice"
                  label={t('forms.costPrice')}
                  type="number"
                  disabled={readOnly}
                />
                {values.tracksStock ? (
                  <FormTextField
                    name="stockQty"
                    label={t('forms.stockQty')}
                    type="number"
                    disabled={readOnly}
                  />
                ) : null}
              </div>
              {!values.tracksStock ? (
                <p className="text-xs text-ink-muted">{t('forms.stockNotTracked')}</p>
              ) : null}

              {initial?.id ? (
                <div className="border-t border-line/60 pt-4">
                  <h4 className="mb-3 text-sm font-semibold text-ink">{t('forms.activityHistory')}</h4>
                  <ActivityTimeline entries={activity} />
                </div>
              ) : null}

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  {t('common.cancel')}
                </Button>
                {!readOnly ? (
                  <Button type="submit" loading={isSubmitting}>
                    {t('common.save')}
                  </Button>
                ) : null}
              </div>
            </Form>
          )
        }}
      </Formik>
    </Modal>
  )
}
