import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus, Search, ShoppingCart, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import { Button, Card, EmptyState, TextField, AssetImage, SearchSelectField, useToast } from '../../../components/ui'
import { PageHeader } from '../../../components/layout'
import { useBarcodeScanner } from '../../pos/useBarcodeScanner'
import { useIdleLock } from '../../pos/useIdleLock'
import { useActionVisibility } from '../../../lib/nav'
import {
  normalizeBusinessNature,
  showsServiceMode,
  showsTables,
  type ServiceMode,
} from '../../../lib/businessNature'
import { looksLikeInvoiceBarcode } from '../../../../shared/invoice'
import { CreateSaleModal } from '../modals/CreateSaleModal'
import { SplitBillModal } from '../modals/SplitBillModal'
import type {
  DiningTable,
  DeliveryStatus,
  PosTicketItem,
  Product,
  SessionUser,
} from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'
import { cn } from '../../../lib/cn'

type CartItem = {
  productId: string
  name: string
  qty: number
  unitPrice: number
  ticketItemId?: string
  seatNo?: number | null
  kitchenStatus?: string
  priceRuleId?: string | null
  billedQty?: number
}

type Props = {
  user: SessionUser
  data: AdminData
  onOpenSale?: (saleId: string) => void
}

const LOW_STOCK_THRESHOLD = 5

export function PosPage({ user, data, onOpenSale }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const { locked, unlock } = useIdleLock(true)
  const [scannedCode, setScannedCode] = useState('')
  const [productQuery, setProductQuery] = useState('')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [cartRevealed, setCartRevealed] = useState(false)
  const [fieldFocused, setFieldFocused] = useState(false)
  const [serviceMode, setServiceMode] = useState<ServiceMode | null>(null)
  const [tables, setTables] = useState<DiningTable[]>([])
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null)
  const [activeTableId, setActiveTableId] = useState<string | null>(null)
  const [ticketItems, setTicketItems] = useState<PosTicketItem[]>([])
  const [splitOpen, setSplitOpen] = useState(false)
  const [riderUserId, setRiderUserId] = useState<string | null>(null)
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus | null>(null)
  const {
    activeBusinessId,
    businesses,
    products,
    branches,
    customers,
    staff,
    refreshScopedData,
  } = data
  const mainBranch = branches.find((b) => b.isMainBranch) ?? branches[0] ?? null
  const business = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null
  const nature = normalizeBusinessNature(business?.businessNature)
  const foodMode = showsServiceMode(nature)
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const refreshTables = useCallback(async () => {
    if (!activeBusinessId || !showsTables(nature)) {
      setTables([])
      return
    }
    try {
      setTables(await window.api.tables.list(activeBusinessId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    }
  }, [activeBusinessId, nature, t, toast])

  useEffect(() => {
    void refreshTables()
  }, [refreshTables])

  useEffect(() => {
    if (!foodMode) {
      setServiceMode(null)
      setActiveTicketId(null)
      setActiveTableId(null)
    }
  }, [foodMode])

  function stockCap(product: Product | undefined): number | null {
    if (!product?.tracksStock) return null
    return product.stockQty
  }

  async function addToCart(productId: string, name: string, fallbackPrice: number) {
    const product = productById.get(productId)
    const cap = stockCap(product)
    let unitPrice = fallbackPrice
    let priceRuleId: string | null = null
    if (activeBusinessId) {
      try {
        const resolved = await window.api.happyHour.resolvePrice({
          businessId: activeBusinessId,
          productId,
        })
        unitPrice = resolved.unitPrice
        priceRuleId = resolved.priceRuleId
      } catch {
        // fall back to catalog price
      }
    }
    setCartRevealed(true)
    setCartItems((prev) => {
      const existing = prev.find(
        (item) => item.productId === productId && (item.priceRuleId ?? null) === priceRuleId,
      )
      const nextQty = (existing?.qty ?? 0) + 1
      if (cap != null && nextQty > cap) {
        toast.error(t('pos.stockCapReached', { name, stock: cap }))
        return prev
      }
      if (existing) {
        return prev.map((item) =>
          item.productId === productId && (item.priceRuleId ?? null) === priceRuleId
            ? { ...item, qty: nextQty }
            : item,
        )
      }
      return [...prev, { productId, name, qty: 1, unitPrice, priceRuleId }]
    })
  }

  function updateQty(productId: string, qty: number, priceRuleId?: string | null) {
    const product = productById.get(productId)
    const cap = stockCap(product)
    setCartItems((prev) => {
      const match = (item: CartItem) =>
        item.productId === productId &&
        (priceRuleId === undefined || (item.priceRuleId ?? null) === (priceRuleId ?? null))
      if (qty <= 0) return prev.filter((item) => !match(item))
      if (cap != null && qty > cap) {
        toast.error(t('pos.stockCapReached', { name: product?.name ?? '', stock: cap }))
        return prev.map((item) => (match(item) ? { ...item, qty: cap } : item))
      }
      return prev.map((item) => (match(item) ? { ...item, qty } : item))
    })
  }

  function setQtyFromInput(productId: string, raw: string, priceRuleId?: string | null) {
    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed)) {
      updateQty(productId, 1, priceRuleId)
      return
    }
    updateQty(productId, Math.max(1, Math.min(9999, parsed)), priceRuleId)
  }

  useBarcodeScanner({
    enabled: !locked && actions.canCheckout && !checkoutOpen && !fieldFocused && (!foodMode || !!serviceMode),
    onScan: (code) => {
      setScannedCode(code)
      void (async () => {
        if (looksLikeInvoiceBarcode(code) && data.activeBusinessId) {
          try {
            const sale = await window.api.sales.findByInvoice({
              businessId: data.activeBusinessId,
              invoiceNo: code.trim(),
            })
            if (!sale) {
              toast.error(t('toast.invoiceNotFound', { invoice: code.trim() }))
              return
            }
            toast.success(t('toast.invoiceOpened', { invoice: sale.invoiceNo }))
            onOpenSale?.(sale.id)
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
          }
          return
        }
        const found = products.find((product) => product.barcode === code && product.isActive)
        if (!found) {
          toast.error(`${t('pos.noBarcode')}: ${code}`)
          return
        }
        addToCart(found.id, found.name, found.price)
      })()
    },
  })

  const cartQtyByProduct = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of cartItems) map.set(item.productId, item.qty)
    return map
  }, [cartItems])

  const hasOverstock = useMemo(
    () =>
      cartItems.some((item) => {
        const product = productById.get(item.productId)
        const cap = stockCap(product)
        return cap != null && item.qty > cap
      }),
    [cartItems, productById],
  )

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    const active = products.filter((product) => product.isActive)
    if (!q) return active
    return active.filter((product) => {
      const name = product.name.toLowerCase()
      const barcode = (product.barcode ?? '').toLowerCase()
      return name.includes(q) || barcode.includes(q)
    })
  }, [products, productQuery])

  async function persistTicketItems(ticketId: string, items: CartItem[]) {
    try {
      const ticket = await window.api.tickets.setItems({
        ticketId,
        items: items.map((item) => ({
          id: item.ticketItemId,
          productId: item.productId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          seatNo: item.seatNo ?? null,
          priceRuleId: item.priceRuleId ?? null,
        })),
      })
      setTicketItems(ticket.items)
      setCartItems((prev) => {
        let changed = false
        const next = prev.map((item) => {
          const match =
            (item.ticketItemId
              ? ticket.items.find((ti) => ti.id === item.ticketItemId)
              : undefined) ??
            ticket.items.find(
              (ti) =>
                ti.productId === item.productId &&
                ti.unitPrice === item.unitPrice &&
                Math.abs(ti.qty - item.qty) < 1e-9,
            )
          if (!match) return item
          if (
            item.ticketItemId === match.id &&
            item.kitchenStatus === match.kitchenStatus &&
            item.billedQty === match.billedQty
          ) {
            return item
          }
          changed = true
          return {
            ...item,
            ticketItemId: match.id,
            kitchenStatus: match.kitchenStatus,
            billedQty: match.billedQty,
            seatNo: match.seatNo,
          }
        })
        return changed ? next : prev
      })
      await refreshTables()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    }
  }

  useEffect(() => {
    if (!activeTicketId) return
    const handle = window.setTimeout(() => {
      void persistTicketItems(activeTicketId, cartItems)
    }, 400)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems, activeTicketId])

  async function openTable(table: DiningTable) {
    if (!activeBusinessId || !mainBranch) return
    try {
      if (table.openTicketId) {
        const ticket = await window.api.tickets.get(table.openTicketId)
        setActiveTicketId(ticket.id)
        setActiveTableId(table.id)
        setServiceMode('dine_in')
        setTicketItems(ticket.items)
        setRiderUserId(ticket.riderUserId)
        setDeliveryStatus(ticket.deliveryStatus)
        setCartItems(
          ticket.items.map((item) => ({
            productId: item.productId,
            name: item.productName,
            qty: item.qty,
            unitPrice: item.unitPrice,
            ticketItemId: item.id,
            seatNo: item.seatNo,
            kitchenStatus: item.kitchenStatus,
            priceRuleId: item.priceRuleId,
            billedQty: item.billedQty,
          })),
        )
        setCartRevealed(true)
        return
      }
      const ticket = await window.api.tickets.open({
        businessId: activeBusinessId,
        branchId: mainBranch.id,
        serviceMode: 'dine_in',
        tableId: table.id,
      })
      setActiveTicketId(ticket.id)
      setActiveTableId(table.id)
      setServiceMode('dine_in')
      setTicketItems([])
      setRiderUserId(null)
      setDeliveryStatus(null)
      setCartItems([])
      setCartRevealed(true)
      await refreshTables()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    }
  }

  async function startMode(mode: ServiceMode) {
    if (mode === 'dine_in') {
      setServiceMode('dine_in')
      setActiveTicketId(null)
      setActiveTableId(null)
      setTicketItems([])
      setRiderUserId(null)
      setDeliveryStatus(null)
      setCartItems([])
      setCartRevealed(false)
      await refreshTables()
      return
    }
    if (!activeBusinessId || !mainBranch) return
    try {
      const ticket = await window.api.tickets.open({
        businessId: activeBusinessId,
        branchId: mainBranch.id,
        serviceMode: mode,
      })
      setServiceMode(mode)
      setActiveTicketId(ticket.id)
      setActiveTableId(null)
      setTicketItems([])
      setRiderUserId(ticket.riderUserId)
      setDeliveryStatus(ticket.deliveryStatus ?? 'pending')
      setCartItems([])
      setCartRevealed(true)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    }
  }

  async function fireHeldToKitchen() {
    if (!activeTicketId) return
    const heldIds = ticketItems
      .filter((item) => item.kitchenStatus === 'held')
      .map((item) => item.id)
    if (!heldIds.length) {
      toast.error(t('pos.nothingToFire'))
      return
    }
    try {
      const ticket = await window.api.tickets.fireItems({ ticketId: activeTicketId, itemIds: heldIds })
      setTicketItems(ticket.items)
      toast.success(t('pos.sentToKitchen'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    }
  }

  async function saveRider(nextRiderId: string | null, nextStatus?: DeliveryStatus | null) {
    if (!activeTicketId) return
    try {
      const ticket = await window.api.tickets.assignRider({
        ticketId: activeTicketId,
        riderUserId: nextRiderId,
        deliveryStatus: nextStatus ?? deliveryStatus,
      })
      setRiderUserId(ticket.riderUserId)
      setDeliveryStatus(ticket.deliveryStatus)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    }
  }

  if (!actions.canCheckout) return null

  const cartTotal = cartItems.reduce((acc, item) => acc + item.qty * item.unitPrice, 0)
  const cartCount = cartItems.reduce((acc, item) => acc + item.qty, 0)
  const showCart = cartRevealed || cartItems.length > 0
  const showProductWall = !foodMode || (serviceMode != null && (serviceMode !== 'dine_in' || !!activeTicketId))
  const showDineInFloor = foodMode && serviceMode === 'dine_in' && !activeTicketId

  return (
    <div className="flex h-[calc(100dvh-4rem-2*var(--space-page))] min-h-[28rem] flex-col gap-4 overflow-hidden sm:gap-5">
      <PageHeader
        className="mb-0 shrink-0"
        eyebrow={t('dashboard.eyebrowPos')}
        title={t('dashboard.pos')}
        description={t('dashboard.posDesc')}
        actions={
          showCart || cartItems.length > 0 ? (
            <Button
              type="button"
              variant="secondary"
              className="relative gap-2 ps-3 pe-2"
              onClick={() => {
                setCartRevealed(true)
                document.getElementById('pos-cart-panel')?.scrollIntoView({ block: 'nearest' })
              }}
            >
              <ShoppingCart className="size-4" />
              <span className="hidden sm:inline">{t('pos.cartCheckout')}</span>
              <span
                className={cn(
                  'grid min-w-7 place-items-center rounded-full px-2 py-0.5 text-xs font-bold tabular-nums',
                  cartCount > 0
                    ? 'bg-brand-primary text-brand-on-primary'
                    : 'bg-surface-muted text-ink-muted',
                )}
              >
                {cartCount}
              </span>
            </Button>
          ) : null
        }
      />

      {locked ? (
        <Card title={t('pos.locked')} className="mx-auto mb-2 max-w-md shrink-0" accent="brand">
          <p className="mb-4 text-sm text-ink-muted">{t('pos.lockedDesc')}</p>
          <Button className="w-full" onClick={unlock}>
            {t('pos.unlock')}
          </Button>
        </Card>
      ) : null}

      {foodMode && !locked ? (
        <div className="flex shrink-0 flex-wrap gap-2">
          {(['dine_in', 'takeaway', 'delivery'] as const).map((mode) => (
            <Button
              key={mode}
              type="button"
              variant={serviceMode === mode ? 'primary' : 'secondary'}
              onClick={() => void startMode(mode)}
            >
              {t(`serviceModes.${mode}`)}
            </Button>
          ))}
          {activeTicketId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={async () => {
                try {
                  await window.api.tickets.cancel(activeTicketId)
                  setActiveTicketId(null)
                  setActiveTableId(null)
                  setCartItems([])
                  setCartRevealed(false)
                  setServiceMode('dine_in')
                  await refreshTables()
                  toast.success(t('toast.ticketCancelled'))
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
                }
              }}
            >
              {t('pos.cancelTicket')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {showDineInFloor ? (
        <Card
          title={t('tables.floor')}
          description={t('pos.pickTable')}
          className="min-h-0 flex-1 overflow-y-auto"
        >
          {tables.filter((table) => table.isActive).length === 0 ? (
            <EmptyState title={t('empty.noTables')} description={t('empty.noTablesDesc')} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {tables
                .filter((table) => table.isActive)
                .map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    className={cn(
                      'rounded-lg border p-4 text-start shadow-soft transition-colors',
                      table.occupied
                        ? 'border-warning/40 bg-warning-soft/40'
                        : 'border-success/30 bg-success-soft/30 hover:border-brand-primary/40',
                    )}
                    onClick={() => void openTable(table)}
                  >
                    <p className="font-semibold text-ink">{table.name}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {table.occupied ? t('tables.occupied') : t('tables.free')}
                    </p>
                    {table.occupied ? (
                      <p className="mt-2 text-sm tabular-nums">{formatMoney(table.openTicketTotal)}</p>
                    ) : null}
                  </button>
                ))}
            </div>
          )}
        </Card>
      ) : null}

      {showProductWall ? (
        <div
          className={cn(
            'grid min-h-0 gap-5',
            showCart ? 'lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.85fr)]' : 'grid-cols-1',
            'min-h-[min(36rem,calc(100vh-14rem))] lg:min-h-0 lg:flex-1 lg:overflow-hidden',
          )}
        >
          <Card className="flex h-full min-h-0 flex-col overflow-hidden !p-0" accent="none">
            <div className="shrink-0 space-y-3 border-b border-line/80 bg-gradient-to-b from-brand-tint/50 to-transparent px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold tracking-tight text-ink">{t('pos.saleFlow')}</h3>
                  <p className="mt-0.5 text-sm text-ink-muted">{t('pos.scanHint')}</p>
                </div>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line/80 bg-surface-raised/90 px-3 py-1 text-xs text-ink-muted shadow-soft">
                  <span className="shrink-0 font-medium text-ink-subtle">{t('pos.lastScanned')}</span>
                  <span className="truncate font-semibold tabular-nums text-ink">
                    {scannedCode || '—'}
                  </span>
                </span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
                <TextField
                  value={productQuery}
                  onChange={(e) => setProductQuery(e.target.value)}
                  placeholder={t('pos.searchProductPlaceholder')}
                  aria-label={t('pos.searchProduct')}
                  className="ps-10"
                  disabled={locked}
                  onFocus={() => setFieldFocused(true)}
                  onBlur={() => setFieldFocused(false)}
                />
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4">
              {products.filter((p) => p.isActive).length === 0 ? (
                <EmptyState title={t('empty.noProducts')} description={t('empty.noProductsDesc')} />
              ) : filteredProducts.length === 0 ? (
                <EmptyState title={t('pos.noProductMatch')} description={t('pos.noProductMatchDesc')} />
              ) : (
                <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.map((product, index) => {
                    const inCartQty = cartQtyByProduct.get(product.id) ?? 0
                    const lowStock = product.tracksStock && product.stockQty <= LOW_STOCK_THRESHOLD
                    const outOfStock = product.tracksStock && product.stockQty <= 0
                    const overCap = product.tracksStock && inCartQty >= product.stockQty
                    return (
                      <motion.button
                        key={product.id}
                        type="button"
                        disabled={locked || outOfStock || overCap}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.16, delay: Math.min(index * 0.015, 0.18) }}
                        className={cn(
                          'group relative flex flex-col gap-3 rounded-lg border bg-surface-raised p-3 text-start shadow-soft transition-[transform,box-shadow,border-color,background-color] duration-pos',
                          'hover:-translate-y-0.5 hover:border-brand-primary/45 hover:bg-brand-tint/35 hover:shadow-lift',
                          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/35 disabled:opacity-50',
                          inCartQty > 0
                            ? 'border-brand-primary/55 bg-brand-tint/40 ring-1 ring-brand-primary/20'
                            : 'border-line/90',
                          outOfStock ? 'border-danger/50 bg-danger-soft/40' : null,
                        )}
                        onClick={() => void addToCart(product.id, product.name, product.price)}
                      >
                        {inCartQty > 0 ? (
                          <span className="absolute end-2.5 top-2.5 z-10 grid min-w-6 place-items-center rounded-full bg-brand-primary px-1.5 py-0.5 text-[11px] font-bold tabular-nums text-brand-on-primary shadow-soft">
                            {inCartQty}
                          </span>
                        ) : null}

                        <div className="flex items-start gap-3">
                          {product.imagePath ? (
                            <AssetImage
                              path={product.imagePath}
                              className="size-14 shrink-0 rounded-lg border border-line object-cover"
                            />
                          ) : (
                            <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-brand-tint to-surface-muted text-sm font-bold tracking-wide text-brand-primary">
                              {product.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="min-w-0 flex-1 pe-6">
                            <p className="truncate font-semibold tracking-tight text-ink">
                              {product.name}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-ink-muted">
                              {product.barcode || t('pos.noSku')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-end justify-between gap-2">
                          <p className="text-base font-bold tabular-nums tracking-tight text-ink">
                            {formatMoney(product.price)}
                          </p>
                          {product.tracksStock ? (
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums',
                                outOfStock
                                  ? 'bg-danger-soft text-danger'
                                  : lowStock
                                    ? 'bg-warning-soft text-warning'
                                    : 'bg-surface-muted text-ink-muted',
                              )}
                            >
                              {t('forms.stock')}: {product.stockQty}
                            </span>
                          ) : null}
                        </div>
                      </motion.button>
                    )
                  })}
                </div>
              )}
            </div>
          </Card>

          <AnimatePresence initial={false}>
            {showCart ? (
              <motion.div
                key="pos-cart"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                className="flex h-full min-h-0 flex-col overflow-hidden"
              >
                <Card className="flex h-full min-h-0 flex-1 flex-col overflow-hidden !p-0">
                  <div className="flex shrink-0 items-start justify-between gap-3 border-b border-line/80 px-4 py-4 sm:px-5">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold tracking-tight text-ink">
                        {t('pos.cartCheckout')}
                      </h3>
                      <p className="mt-0.5 text-sm text-ink-muted">
                        {cartCount > 0
                          ? t('pos.cartItemsCount', { count: cartCount })
                          : t('empty.cartEmptyDesc')}
                      </p>
                    </div>
                    {cartItems.length === 0 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0 px-2"
                        aria-label={t('common.close')}
                        onClick={() => setCartRevealed(false)}
                      >
                        <X className="size-4" />
                      </Button>
                    ) : null}
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4">
                    {cartItems.length === 0 ? (
                      <EmptyState title={t('empty.cartEmpty')} description={t('empty.cartEmptyDesc')} />
                    ) : (
                      <div className="space-y-2">
                        {cartItems.map((item, index) => {
                          const product = productById.get(item.productId)
                          const over =
                            product?.tracksStock && item.qty > product.stockQty
                          const rowKey = item.ticketItemId ?? `${item.productId}-${item.unitPrice}-${index}`
                          return (
                            <motion.div
                              key={rowKey}
                              layout
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.12) }}
                              className={cn(
                                'rounded-lg border px-3 py-2.5',
                                over
                                  ? 'border-danger/50 bg-danger-soft/40'
                                  : 'border-line/90 bg-surface-muted/30',
                              )}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold tracking-tight text-ink">
                                    {item.name}
                                  </p>
                                  <p className="mt-0.5 text-xs text-ink-muted tabular-nums">
                                    {formatMoney(item.unitPrice)} × {item.qty}
                                    {item.kitchenStatus && item.kitchenStatus !== 'held'
                                      ? ` · ${t(`kitchen.status.${item.kitchenStatus}`)}`
                                      : ''}
                                  </p>
                                  {over ? (
                                    <p className="mt-1 text-xs text-danger">{t('pos.overstockLine')}</p>
                                  ) : null}
                                </div>
                                <p className="shrink-0 text-sm font-bold tabular-nums text-ink">
                                  {formatMoney(item.qty * item.unitPrice)}
                                </p>
                              </div>

                              <div className="mt-2.5 flex items-center justify-between gap-2">
                                <div className="inline-flex items-center overflow-hidden rounded-lg border border-line/90 bg-surface-raised shadow-soft">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-9 min-w-9 rounded-none px-2"
                                    disabled={locked}
                                    aria-label="Decrease quantity"
                                    onClick={() =>
                                      updateQty(item.productId, item.qty - 1, item.priceRuleId)
                                    }
                                  >
                                    <Minus className="size-3.5" />
                                  </Button>
                                  <TextField
                                    type="number"
                                    min={1}
                                    max={product?.tracksStock ? product.stockQty : 9999}
                                    value={String(item.qty)}
                                    disabled={locked}
                                    aria-label={t('pos.quantity')}
                                    className="h-9 w-12 rounded-none border-0 px-1 text-center text-sm tabular-nums shadow-none focus:ring-0"
                                    containerClassName="w-auto"
                                    onFocus={() => setFieldFocused(true)}
                                    onBlur={(e) => {
                                      setFieldFocused(false)
                                      if (!e.target.value.trim()) {
                                        updateQty(item.productId, 1, item.priceRuleId)
                                      }
                                    }}
                                    onChange={(e) => {
                                      const raw = e.target.value
                                      if (raw === '') return
                                      setQtyFromInput(item.productId, raw, item.priceRuleId)
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-9 min-w-9 rounded-none px-2"
                                    disabled={
                                      locked ||
                                      (product?.tracksStock != null &&
                                        product.tracksStock &&
                                        item.qty >= product.stockQty)
                                    }
                                    aria-label="Increase quantity"
                                    onClick={() =>
                                      updateQty(item.productId, item.qty + 1, item.priceRuleId)
                                    }
                                  >
                                    <Plus className="size-3.5" />
                                  </Button>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-ink-muted hover:text-danger"
                                  disabled={locked}
                                  aria-label={t('common.remove')}
                                  onClick={() => updateQty(item.productId, 0, item.priceRuleId)}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 space-y-3 border-t border-line/80 bg-gradient-to-t from-brand-tint/40 to-transparent p-4 sm:p-5">
                    {foodMode &&
                    activeTicketId &&
                    (serviceMode === 'takeaway' || serviceMode === 'delivery') ? (
                      <div className="space-y-2">
                        <SearchSelectField
                          label={t('pos.rider')}
                          value={riderUserId ?? ''}
                          onChange={(value) => {
                            const next = value || null
                            setRiderUserId(next)
                            void saveRider(next)
                          }}
                          options={[
                            { value: '', label: t('pos.riderNone') },
                            ...staff
                              .filter((s) => s.isActive)
                              .map((s) => ({ value: s.id, label: s.name })),
                          ]}
                          placeholder={t('pos.riderPlaceholder')}
                        />
                        <SearchSelectField
                          label={t('pos.deliveryStatus')}
                          value={deliveryStatus ?? 'pending'}
                          onChange={(value) => {
                            const next = (value || 'pending') as DeliveryStatus
                            setDeliveryStatus(next)
                            void saveRider(riderUserId, next)
                          }}
                          options={[
                            { value: 'pending', label: t('deliveryStatus.pending') },
                            { value: 'assigned', label: t('deliveryStatus.assigned') },
                            {
                              value: 'out_for_delivery',
                              label: t('deliveryStatus.out_for_delivery'),
                            },
                            { value: 'delivered', label: t('deliveryStatus.delivered') },
                            { value: 'cancelled', label: t('deliveryStatus.cancelled') },
                          ]}
                        />
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-3 rounded-lg bg-brand-primary px-4 py-3 shadow-glow">
                      <span className="text-sm font-semibold text-brand-on-primary/90">
                        {t('pos.total')}
                      </span>
                      <span className="text-lg font-bold tabular-nums tracking-tight text-brand-on-primary">
                        {formatMoney(cartTotal)}
                      </span>
                    </div>
                    {foodMode && activeTicketId ? (
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={locked || cartItems.length === 0}
                          onClick={() => void fireHeldToKitchen()}
                        >
                          {t('pos.sendToKitchen')}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={locked || ticketItems.every((i) => i.billedQty >= i.qty)}
                          onClick={() => setSplitOpen(true)}
                        >
                          {t('pos.splitBill')}
                        </Button>
                      </div>
                    ) : null}
                    <Button
                      className="w-full"
                      size="lg"
                      disabled={
                        locked ||
                        !activeBusinessId ||
                        !mainBranch ||
                        cartItems.length === 0 ||
                        hasOverstock ||
                        (foodMode && !serviceMode) ||
                        (foodMode && !activeTicketId)
                      }
                      onClick={() => {
                        if (hasOverstock) {
                          toast.error(t('pos.overstockBlocked'))
                          return
                        }
                        setCheckoutOpen(true)
                      }}
                    >
                      {t('pos.createSale')}
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      {activeBusinessId && mainBranch ? (
        <CreateSaleModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          cartItems={cartItems.map((item) => ({
            productId: item.productId,
            name: item.name,
            qty: item.qty,
            unitPrice: item.unitPrice,
            ticketItemId: item.ticketItemId,
            priceRuleId: item.priceRuleId,
          }))}
          customers={customers}
          staff={staff}
          businessId={activeBusinessId}
          branchId={mainBranch.id}
          businessNature={nature}
          canPrint={actions.canPrint}
          serviceMode={foodMode ? serviceMode : null}
          tableId={serviceMode === 'dine_in' ? activeTableId : null}
          ticketId={activeTicketId}
          hasOverstock={hasOverstock}
          riderUserId={riderUserId}
          onCompleted={async () => {
            setCartItems([])
            setCartRevealed(false)
            setActiveTicketId(null)
            setActiveTableId(null)
            setTicketItems([])
            setRiderUserId(null)
            setDeliveryStatus(null)
            if (foodMode) setServiceMode(null)
            await refreshScopedData(activeBusinessId)
            await refreshTables()
          }}
        />
      ) : null}

      {activeBusinessId && mainBranch && activeTicketId && serviceMode ? (
        <SplitBillModal
          open={splitOpen}
          onClose={() => setSplitOpen(false)}
          ticketId={activeTicketId}
          items={ticketItems}
          customers={customers}
          staff={staff}
          businessId={activeBusinessId}
          branchId={mainBranch.id}
          businessNature={nature}
          canPrint={actions.canPrint}
          serviceMode={serviceMode}
          tableId={activeTableId}
          onCompleted={async () => {
            const ticket = await window.api.tickets.get(activeTicketId)
            if (ticket.status !== 'open') {
              setCartItems([])
              setActiveTicketId(null)
              setActiveTableId(null)
              setTicketItems([])
              setServiceMode(null)
              setCartRevealed(false)
            } else {
              setTicketItems(ticket.items)
              setCartItems(
                ticket.items
                  .filter((item) => item.billedQty < item.qty)
                  .map((item) => ({
                    productId: item.productId,
                    name: item.productName,
                    qty: item.qty - item.billedQty,
                    unitPrice: item.unitPrice,
                    ticketItemId: item.id,
                    seatNo: item.seatNo,
                    kitchenStatus: item.kitchenStatus,
                    priceRuleId: item.priceRuleId,
                    billedQty: item.billedQty,
                  })),
              )
            }
            await refreshScopedData(activeBusinessId)
            await refreshTables()
          }}
        />
      ) : null}
    </div>
  )
}
