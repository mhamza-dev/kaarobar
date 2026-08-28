import { useMemo, useState } from 'react'
import { Form, Formik } from 'formik'
import * as Yup from 'yup'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import { Button, Modal, Checkbox, useToast } from '../../../components/ui'
import { FormNumberField, FormSelectField } from '../../../components/form'
import type { Customer, PosTicketItem, StaffUser } from '../../../../shared/types/api'
import type { BusinessNature, ServiceMode } from '../../../lib/businessNature'
import { CreateSaleModal, type CartLine } from './CreateSaleModal'

type SplitMode = 'items' | 'seat' | 'equal'

type Props = {
  open: boolean
  onClose: () => void
  ticketId: string
  items: PosTicketItem[]
  customers: Customer[]
  staff: StaffUser[]
  businessId: string
  branchId: string
  businessNature: BusinessNature
  canPrint: boolean
  serviceMode: ServiceMode
  tableId: string | null
  onCompleted: () => Promise<void>
}

type FormValues = {
  mode: SplitMode
  equalParts: number
  seatNo: string
}

export function SplitBillModal({
  open,
  onClose,
  ticketId,
  items,
  customers,
  staff,
  businessId,
  branchId,
  businessNature,
  canPrint,
  serviceMode,
  tableId,
  onCompleted,
}: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [payLines, setPayLines] = useState<CartLine[] | null>(null)

  const unbilled = useMemo(
    () =>
      items
        .map((item) => ({
          ...item,
          remaining: Math.max(0, item.qty - item.billedQty),
        }))
        .filter((item) => item.remaining > 0),
    [items],
  )

  const seats = useMemo(() => {
    const set = new Set<number>()
    for (const item of unbilled) {
      if (item.seatNo != null) set.add(item.seatNo)
    }
    return [...set].sort((a, b) => a - b)
  }, [unbilled])

  const schema = useMemo(
    () =>
      Yup.object({
        mode: Yup.mixed<SplitMode>().oneOf(['items', 'seat', 'equal']).required(),
        equalParts: Yup.number().min(2).max(20).required(),
        seatNo: Yup.string(),
      }),
    [],
  )

  function buildPartition(values: FormValues): CartLine[] {
    if (values.mode === 'items') {
      const picked = unbilled.filter((item) => selectedIds.includes(item.id))
      if (!picked.length) throw new Error(t('split.selectItems'))
      return picked.map((item) => ({
        productId: item.productId,
        name: item.productName,
        qty: item.remaining,
        unitPrice: item.unitPrice,
        ticketItemId: item.id,
        priceRuleId: item.priceRuleId,
      }))
    }
    if (values.mode === 'seat') {
      const seat = Number(values.seatNo)
      if (!Number.isFinite(seat)) throw new Error(t('split.seatRequired'))
      const picked = unbilled.filter((item) => item.seatNo === seat)
      if (!picked.length) throw new Error(t('split.seatEmpty'))
      return picked.map((item) => ({
        productId: item.productId,
        name: item.productName,
        qty: item.remaining,
        unitPrice: item.unitPrice,
        ticketItemId: item.id,
        priceRuleId: item.priceRuleId,
      }))
    }
    const parts = Math.max(2, Math.floor(Number(values.equalParts) || 2))
    return unbilled
      .map((item) => {
        const share = Math.floor((item.remaining / parts) * 1000) / 1000
        if (share <= 0) return null
        return {
          productId: item.productId,
          name: item.productName,
          qty: share,
          unitPrice: item.unitPrice,
          ticketItemId: item.id,
          priceRuleId: item.priceRuleId,
        }
      })
      .filter(Boolean) as CartLine[]
  }

  return (
    <>
      <Modal open={open && !payLines} onClose={onClose} title={t('split.title')} size="lg">
        <Formik<FormValues>
          initialValues={{
            mode: 'items',
            equalParts: 2,
            seatNo: seats[0] != null ? String(seats[0]) : '',
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={(values) => {
            try {
              const lines = buildPartition(values)
              if (!lines.length) {
                toast.error(t('split.nothingToBill'))
                return
              }
              setPayLines(lines)
            } catch (e) {
              toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
            }
          }}
        >
          {({ values }) => (
            <Form className="flex flex-col gap-4">
              <FormSelectField
                name="mode"
                label={t('split.mode')}
                options={[
                  { value: 'items', label: t('split.modeItems') },
                  { value: 'seat', label: t('split.modeSeat') },
                  { value: 'equal', label: t('split.modeEqual') },
                ]}
              />
              {values.mode === 'equal' ? (
                <FormNumberField name="equalParts" label={t('split.equalParts')} />
              ) : null}
              {values.mode === 'seat' ? (
                <FormSelectField
                  name="seatNo"
                  label={t('split.seat')}
                  options={seats.map((n) => ({
                    value: String(n),
                    label: t('kitchen.seat', { n }),
                  }))}
                />
              ) : null}
              {values.mode === 'items' ? (
                <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-line p-3">
                  {unbilled.map((item) => (
                    <Checkbox
                      key={item.id}
                      checked={selectedIds.includes(item.id)}
                      onChange={(e) => {
                        const next = e.target.checked
                        setSelectedIds((prev) =>
                          next ? [...prev, item.id] : prev.filter((id) => id !== item.id),
                        )
                      }}
                      label={
                        <span className="flex w-full items-center justify-between gap-3">
                          <span>
                            {item.remaining}× {item.productName}
                            {item.seatNo != null
                              ? ` · ${t('kitchen.seat', { n: item.seatNo })}`
                              : ''}
                          </span>
                          <span className="text-ink-muted">
                            {formatMoney(item.remaining * item.unitPrice)}
                          </span>
                        </span>
                      }
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-ink-muted">
                  {t('split.unbilledTotal', {
                    amount: formatMoney(
                      unbilled.reduce((acc, item) => acc + item.remaining * item.unitPrice, 0),
                    ),
                  })}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="secondary" onClick={onClose}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">{t('split.continuePay')}</Button>
              </div>
            </Form>
          )}
        </Formik>
      </Modal>

      {payLines ? (
        <CreateSaleModal
          open
          onClose={() => setPayLines(null)}
          cartItems={payLines}
          customers={customers}
          staff={staff}
          businessId={businessId}
          branchId={branchId}
          businessNature={businessNature}
          canPrint={canPrint}
          serviceMode={serviceMode}
          tableId={tableId}
          ticketId={ticketId}
          partialTicketBill
          onCompleted={async () => {
            setPayLines(null)
            onClose()
            await onCompleted()
          }}
        />
      ) : null}
    </>
  )
}
