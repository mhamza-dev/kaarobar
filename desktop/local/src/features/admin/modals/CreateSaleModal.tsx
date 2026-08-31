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

// The same product can appear twice at two prices — a happy-hour line and a
// full-price one — so the line, not the product, is what a discount belongs to.
function lineKey(item: CartLine): string {
  return item.ticketItemId ?? `${item.productId}-${item.unitPrice}`
}

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
  const [walkInName, setWalkInName] = useState('')
  // A shopkeeper knocks money off one damaged shirt, or off the whole bill —
  // rarely both in the same breath. One mode at a time keeps the arithmetic on
  // screen something the customer can follow, which is the point of showing it.
  const [discountMode, setDiscountMode] = useState<'total' | 'item'>('total')
  const [discountInput, setDiscountInput] = useState('0')
  // Keyed by cart line, not by product: the same product can sit on two lines
  // at two prices, and they can be discounted differently.
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, string>>({})
  // Which button is busy, so only that one shows a spinner.
  const [submitting, setSubmitting] = useState<'save' | 'print' | null>(null)
  const requireServedBy = showsServedBy(businessNature)

  const subtotal = cartItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0)
  const totalItems = cartItems.reduce((acc, item) => acc + item.qty, 0)

  // What the shopkeeper types is money off *one* of them — "50 off each shirt"
  // — which is how the discount is actually given and argued about at the
  // counter. Five shirts at 50 off is 250 off the line.
  //
  // Clamped to the line's own value, so a mistyped 5000 on a 500 item takes
  // 500 off and not the rest of the basket with it.
  const lineDiscountFor = (item: CartLine) => {
    const perUnit = Number(itemDiscounts[lineKey(item)] || 0)
    if (!Number.isFinite(perUnit) || perUnit <= 0) return 0
    return Math.min(perUnit * item.qty, item.qty * item.unitPrice)
  }

  const perItemDiscounts =
    discountMode === 'item' ? cartItems.map(lineDiscountFor) : cartItems.map(() => 0)
  const perItemTotal = perItemDiscounts.reduce((acc, value) => acc + value, 0)

  const orderDiscountRaw = Math.max(0, Number(discountInput || 0))
  const orderDiscount =
    discountMode === 'total' && Number.isFinite(orderDiscountRaw)
      ? Math.min(orderDiscountRaw, subtotal)
      : 0

  const safeDiscount = Math.min(perItemTotal + orderDiscount, subtotal)
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
        customerName: selectedCustomerId ? null : walkInName.trim() || null,
        items: cartItems.map((item, index) => ({
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          discount: perItemDiscounts[index] ?? 0,
          ticketItemId: item.ticketItemId,
          priceRuleId: item.priceRuleId,
        })),
        discount: orderDiscount,
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
      setWalkInName('')
      setDiscountMode('total')
      setDiscountInput('0')
      setItemDiscounts({})
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
          <div className="max-h-52 space-y-1 overflow-y-auto pe-1">
            {cartItems.map((item, index) => {
              const gross = item.qty * item.unitPrice
              const off = perItemDiscounts[index] ?? 0
              return (
                <div
                  key={lineKey(item)}
                  className="rounded-lg border border-line/70 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate pe-3">
                      {item.name} × {item.qty}
                    </span>
                    <span className="shrink-0 tabular-nums">
                      {off > 0 ? (
                        <>
                          <span className="me-2 text-ink-muted line-through">
                            {formatMoney(gross)}
                          </span>
                          {formatMoney(gross - off)}
                        </>
                      ) : (
                        formatMoney(gross)
                      )}
                    </span>
                  </div>
                  {discountMode === 'item' ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        max={item.unitPrice}
                        step="any"
                        inputMode="decimal"
                        aria-label={t('pos.itemDiscount', { name: item.name })}
                        placeholder={t('pos.discountPerUnit')}
                        className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm tabular-nums"
                        value={itemDiscounts[lineKey(item)] ?? ''}
                        onChange={(e) =>
                          setItemDiscounts((current) => ({
                            ...current,
                            [lineKey(item)]: e.target.value,
                          }))
                        }
                      />
                      {/* What it comes to across the line, so nobody has to do
                          the multiplication in their head with a queue waiting. */}
                      <span className="shrink-0 whitespace-nowrap text-xs text-ink-muted tabular-nums">
                        {off > 0
                          ? t('pos.discountPerUnitApplied', {
                              qty: item.qty,
                              total: formatMoney(off),
                            })
                          : t('pos.discountPerUnitHint')}
                      </span>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
          <div className="grid gap-2 border-t border-line/60 pt-2 text-sm">
            <div className="flex items-center justify-between text-ink-muted">
              <span>{t('pos.subtotal')}</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>

            <fieldset className="grid gap-2">
              <legend className="text-sm font-medium text-ink">{t('pos.discountMode')}</legend>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="create-sale-discount-mode"
                    checked={discountMode === 'total'}
                    onChange={() => setDiscountMode('total')}
                  />
                  {t('pos.discountWholeSale')}
                </label>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input
                    type="radio"
                    name="create-sale-discount-mode"
                    checked={discountMode === 'item'}
                    onChange={() => setDiscountMode('item')}
                  />
                  {t('pos.discountPerItem')}
                </label>
              </div>
            </fieldset>

            {discountMode === 'total' ? (
              <TextField
                label={t('pos.discount')}
                type="number"
                min={0}
                step="any"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
              />
            ) : (
              <div className="flex items-center justify-between text-ink-muted">
                <span>{t('pos.discountTotalLabel')}</span>
                <span className="tabular-nums">{formatMoney(safeDiscount)}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-base font-semibold text-ink">
              <span>{t('pos.total')}</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
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

        {selectedCustomerId ? null : (
          <div className="space-y-1">
            <TextField
              label={t('pos.walkInName')}
              value={walkInName}
              placeholder={t('pos.walkInNamePlaceholder')}
              maxLength={120}
              onChange={(e) => setWalkInName(e.target.value)}
            />
            <p className="text-xs text-ink-muted">{t('pos.walkInNameHint')}</p>
          </div>
        )}

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
