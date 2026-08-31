import { useId, useMemo, useState } from 'react'
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
  const discountModeLabelId = useId()
  const orderDiscountId = useId()
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
        {/* The basket, laid out the way the receipt it becomes is: the name and
            the arithmetic on the left, one column of money down the right edge
            in tabular figures. A cashier scanning a basket with a customer
            waiting reads down that column, so nothing else is allowed into it. */}
        <section className="rounded-xl border border-line bg-surface-muted/40 p-3">
          <header className="flex flex-wrap items-baseline justify-between gap-2 pb-2">
            <h4 className="text-sm font-semibold text-ink">{t('pos.cartCheckout')}</h4>
            <span className="text-xs font-medium text-ink-muted">
              {t('pos.cartItemsCount', { count: totalItems })}
            </span>
          </header>

          <ul className="max-h-64 divide-y divide-line/60 overflow-y-auto border-y border-line/60">
            {cartItems.map((item, index) => {
              const off = perItemDiscounts[index] ?? 0
              const charged = item.qty * item.unitPrice - off
              return (
                <li
                  key={lineKey(item)}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-2"
                >
                  <span className="truncate text-sm font-medium text-ink">{item.name}</span>
                  <span className="min-w-[5.5rem] text-end text-sm font-semibold tabular-nums text-ink">
                    {formatMoney(charged)}
                  </span>

                  <div className="col-start-1 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                    {/* The unit price, always. Without it a line of "× 5" tells
                        a cashier nothing they can check a discount against. */}
                    <span className="tabular-nums">
                      {item.qty} × {formatMoney(item.unitPrice)}
                    </span>

                    {discountMode === 'item' ? (
                      <>
                        <span aria-hidden className="text-ink-subtle">
                          ·
                        </span>
                        <span className="inline-flex items-center rounded-md border border-line bg-surface focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/25">
                          <span aria-hidden className="ps-2 text-ink-subtle">
                            −
                          </span>
                          <input
                            type="number"
                            min={0}
                            max={item.unitPrice}
                            step="any"
                            inputMode="decimal"
                            aria-label={t('pos.itemDiscount', { name: item.name })}
                            placeholder="0"
                            className="w-14 bg-transparent px-1 py-1 text-end text-xs tabular-nums text-ink outline-none"
                            value={itemDiscounts[lineKey(item)] ?? ''}
                            onChange={(e) =>
                              setItemDiscounts((current) => ({
                                ...current,
                                [lineKey(item)]: e.target.value,
                              }))
                            }
                          />
                          <span className="pe-2 text-ink-subtle">
                            {t('pos.discountPerUnitHint')}
                          </span>
                        </span>
                        {/* What the per-unit figure came to across the line.
                            Shown rather than left as mental arithmetic, because
                            getting it wrong is money. */}
                        {off > 0 ? (
                          <span className="font-medium tabular-nums text-danger">
                            −{formatMoney(off)}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="grid gap-2 pt-3 text-sm">
            <div className="flex items-baseline justify-between text-ink-muted">
              <span>{t('pos.subtotal')}</span>
              <span className="tabular-nums">{formatMoney(subtotal)}</span>
            </div>

            {/* The choice sits where its effect is shown. A segmented control
                rather than two radios: it is one decision with two answers, and
                it has to be hittable on a touchscreen till. */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span id={discountModeLabelId} className="text-ink-muted">
                {t('pos.discountMode')}
              </span>
              <div
                role="radiogroup"
                aria-labelledby={discountModeLabelId}
                className="inline-flex rounded-lg border border-line bg-surface p-0.5"
              >
                {(['total', 'item'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={discountMode === mode}
                    onClick={() => setDiscountMode(mode)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors duration-pos ${
                      discountMode === mode
                        ? 'bg-brand-primary text-brand-on-primary'
                        : 'text-ink-muted hover:text-ink'
                    }`}
                  >
                    {mode === 'total' ? t('pos.discountWholeSale') : t('pos.discountPerItem')}
                  </button>
                ))}
              </div>
            </div>

            {discountMode === 'total' ? (
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={orderDiscountId} className="text-ink-muted">
                  {t('pos.discount')}
                </label>
                <input
                  id={orderDiscountId}
                  type="number"
                  min={0}
                  max={subtotal}
                  step="any"
                  inputMode="decimal"
                  placeholder="0"
                  className="w-32 rounded-lg border border-line bg-surface px-3 py-1.5 text-end text-sm tabular-nums text-ink outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/25"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex items-baseline justify-between">
                <span className="text-ink-muted">{t('pos.discountTotalLabel')}</span>
                <span className="tabular-nums text-ink">
                  {safeDiscount > 0 ? `−${formatMoney(safeDiscount)}` : formatMoney(0)}
                </span>
              </div>
            )}

            <div className="flex items-baseline justify-between border-t border-line pt-2 text-base font-semibold text-ink">
              <span>{t('pos.total')}</span>
              <span className="tabular-nums">{formatMoney(total)}</span>
            </div>
          </div>
        </section>

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
