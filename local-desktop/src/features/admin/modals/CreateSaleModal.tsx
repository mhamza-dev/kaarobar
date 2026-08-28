import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import { toastSalePrintResult } from '../../../lib/printReceipt'
import { Button, Modal, SearchSelectField, TextField, useToast } from '../../../components/ui'
import { showsServedBy, type BusinessNature, type ServiceMode } from '../../../lib/businessNature'
import { hasLicenseFeature, useLicenseFeatures } from '../../../lib/license'
import type { Customer, StaffUser } from '../../../../shared/types/api'

export type CartLine = {
  productId: string
  name: string
  qty: number
  unitPrice: number
  ticketItemId?: string
  priceRuleId?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  cartItems: CartLine[]
  customers: Customer[]
  staff: StaffUser[]
  businessId: string
  branchId: string
  businessNature: BusinessNature
  canPrint: boolean
  serviceMode?: ServiceMode | null
  tableId?: string | null
  ticketId?: string | null
  hasOverstock?: boolean
  partialTicketBill?: boolean
  riderUserId?: string | null
  onCompleted: (saleId: string) => Promise<void>
}

const CASH_SALE_VALUE = ''

export function CreateSaleModal({
  open,
  onClose,
  cartItems,
  customers,
  staff,
  businessId,
  branchId,
  businessNature,
  canPrint,
  serviceMode = null,
  tableId = null,
  ticketId = null,
  hasOverstock = false,
  partialTicketBill = false,
  riderUserId = null,
  onCompleted,
}: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const licenseFeatures = useLicenseFeatures()
  // Plans without credit management sell to customers cash/card only.
  const creditEnabled = hasLicenseFeature(licenseFeatures, 'credit')
  const [selectedCustomerId, setSelectedCustomerId] = useState(CASH_SALE_VALUE)
  const [servedByUserId, setServedByUserId] = useState('')
  const [paymentChoice, setPaymentChoice] = useState<'credit' | 'cash' | 'card'>(
    creditEnabled ? 'credit' : 'cash',
  )
  const [walkInPayment, setWalkInPayment] = useState<'cash' | 'card'>('cash')
  const [discountInput, setDiscountInput] = useState('0')
  // Which button is busy, so only that one shows a spinner.
  const [submitting, setSubmitting] = useState<'save' | 'print' | null>(null)
  const requireServedBy = showsServedBy(businessNature)

  const subtotal = cartItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0)
  const totalItems = cartItems.reduce((acc, item) => acc + item.qty, 0)
  const discount = Math.max(0, Number(discountInput || 0))
  const safeDiscount = Number.isFinite(discount) ? Math.min(discount, subtotal) : 0
  const total = Math.max(0, subtotal - safeDiscount)

  const customerOptions = useMemo(
    () => [
      { value: CASH_SALE_VALUE, label: t('pos.cashSale') },
      ...customers
        .filter((customer) => customer.isActive)
        .map((customer) => ({
          value: customer.id,
          label: customer.phone ? `${customer.name} · ${customer.phone}` : customer.name,
        })),
    ],
    [customers, t],
  )

  const staffOptions = useMemo(
    () =>
      staff
        .filter((member) => member.isActive)
        .map((member) => ({
          value: member.id,
          label: member.name,
        })),
    [staff],
  )

  const saleBlocked =
    cartItems.length === 0 || hasOverstock || (requireServedBy && !servedByUserId)

  async function confirmSale({ print }: { print: boolean }) {
    if (hasOverstock) {
      toast.error(t('pos.overstockBlocked'))
      return
    }
    if (requireServedBy && !servedByUserId) {
      toast.error(t('pos.servedByRequired'))
      return
    }
    setSubmitting(print ? 'print' : 'save')
    try {
      const paymentMethod = selectedCustomerId ? paymentChoice : walkInPayment
      const sale = await window.api.sales.create({
        businessId,
        branchId,
        customerId: selectedCustomerId || null,
        items: cartItems.map((item) => ({
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          ticketItemId: item.ticketItemId,
          priceRuleId: item.priceRuleId,
        })),
        discount: safeDiscount,
        payments: [{ method: paymentMethod, amount: total }],
        servedByUserId: requireServedBy ? servedByUserId : null,
        serviceMode: serviceMode ?? undefined,
        tableId: tableId ?? undefined,
        ticketId: ticketId ?? undefined,
        partialTicketBill: partialTicketBill || undefined,
        riderUserId: riderUserId ?? undefined,
      })
      toast.success(t('toast.saleCompleted'), sale.invoiceNo)
      // The sale is already saved, so a printer problem must not read as a
      // failed sale — and the till must not wait on the spooler either. Fire
      // the print, close immediately, and toast the outcome when it lands.
      if (print) {
        void window.api.sales
          .printReceipt(sale.id)
          .then((printResult) => toastSalePrintResult(printResult, toast, t))
          .catch((printError) => {
            toast.error(
              printError instanceof Error ? printError.message : t('toast.actionFailed'),
            )
          })
      }
      setSelectedCustomerId(CASH_SALE_VALUE)
      setServedByUserId('')
      setPaymentChoice(creditEnabled ? 'credit' : 'cash')
      setWalkInPayment('cash')
      setDiscountInput('0')
      await onCompleted(sale.id)
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('pos.createSale')}
      size="md"
      footer={
        <div className="flex w-full flex-col-reverse justify-end gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting !== null}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            loading={submitting === 'save'}
            disabled={saleBlocked || submitting !== null}
            onClick={() => void confirmSale({ print: false })}
          >
            {t('pos.confirmSale')}
          </Button>
          {canPrint ? (
            <Button
              type="button"
              loading={submitting === 'print'}
              disabled={saleBlocked || submitting !== null}
              onClick={() => void confirmSale({ print: true })}
            >
              {t('pos.confirmSaleAndPrint')}
            </Button>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2 rounded-lg border border-white/40 bg-surface-muted/30 p-3 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-ink">{t('pos.cartCheckout')}</h4>
            <span className="text-xs font-medium text-ink-muted">
              {t('pos.cartItemsCount', { count: totalItems })}
            </span>
          </div>
          <div className="max-h-40 space-y-1 overflow-y-auto pe-1">
            {cartItems.map((item) => (
              <div
                key={item.ticketItemId ?? `${item.productId}-${item.unitPrice}`}
                className="flex items-center justify-between rounded-lg border border-line/70 px-3 py-2 text-sm"
              >
                <span className="truncate pe-3">
                  {item.name} × {item.qty}
                </span>
                <span className="shrink-0">{formatMoney((item.qty * item.unitPrice))}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-2 border-t border-line/60 pt-2 text-sm">
            <div className="flex items-center justify-between text-ink-muted">
              <span>{t('pos.subtotal')}</span>
              <span>{formatMoney(subtotal)}</span>
            </div>
            <TextField
              label={t('pos.discount')}
              type="number"
              min={0}
              step="any"
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
            />
            <div className="flex items-center justify-between text-base font-semibold text-ink">
              <span>{t('pos.total')}</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        {hasOverstock ? (
          <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
            {t('pos.overstockBlocked')}
          </p>
        ) : null}

        {requireServedBy ? (
          <SearchSelectField
            label={t('pos.servedBy')}
            value={servedByUserId}
            options={staffOptions}
            placeholder={t('pos.servedByPlaceholder')}
            searchPlaceholder={t('pos.servedByPlaceholder')}
            emptyText={t('empty.noUsers')}
            onChange={setServedByUserId}
          />
        ) : null}

        <SearchSelectField
          label={t('pos.searchCustomer')}
          value={selectedCustomerId}
          options={customerOptions}
          placeholder={t('pos.cashSale')}
          searchPlaceholder={t('pos.searchCustomerPlaceholder')}
          emptyText={t('empty.noCustomers')}
          onChange={(next) => {
            setSelectedCustomerId(next)
            if (next) setPaymentChoice(creditEnabled ? 'credit' : 'cash')
          }}
        />

        {selectedCustomerId ? (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">{t('pos.paymentMethod')}</legend>
            {creditEnabled ? (
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="radio"
                  name="create-sale-payment"
                  checked={paymentChoice === 'credit'}
                  onChange={() => setPaymentChoice('credit')}
                />
                {t('pos.payCredit')}
              </label>
            ) : null}
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="create-sale-payment"
                checked={paymentChoice === 'cash'}
                onChange={() => setPaymentChoice('cash')}
              />
              {t('pos.payCash')}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="create-sale-payment"
                checked={paymentChoice === 'card'}
                onChange={() => setPaymentChoice('card')}
              />
              {t('pos.payCard')}
            </label>
          </fieldset>
        ) : (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-ink">{t('pos.paymentMethod')}</legend>
            <p className="text-sm text-ink-muted">{t('pos.walkInCashHint')}</p>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="create-sale-walk-in-payment"
                checked={walkInPayment === 'cash'}
                onChange={() => setWalkInPayment('cash')}
              />
              {t('pos.payCash')}
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="radio"
                name="create-sale-walk-in-payment"
                checked={walkInPayment === 'card'}
                onChange={() => setWalkInPayment('card')}
              />
              {t('pos.payCard')}
            </label>
          </fieldset>
        )}
      </div>
    </Modal>
  )
}
