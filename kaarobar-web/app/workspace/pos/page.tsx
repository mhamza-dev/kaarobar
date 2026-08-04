"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Banknote,
  BookUser,
  Check,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
  UserRoundPlus,
  Wallet,
  X,
} from "lucide-react";
import { api, apiAllPages, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import Modal from "@/components/modals/Modal";
import InfoButton from "@/components/ui/InfoButton";
import CustomForm from "@/components/ui/CustomForm";
import { FormikTextField } from "@/components/ui/FormFields";
import { StatusBadge, fieldClass, formStackClass } from "@/components/app/ui";
import SaleReceiptModal, { type ReceiptSale } from "@/components/app/SaleReceiptModal";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { formatDecimal } from "@/lib/decimal";
import {
  closeTillFormSchema,
  emptyCloseTillForm,
  emptyOpenTillForm,
  emptyPosNewCustomerForm,
  openTillFormSchema,
  posNewCustomerFormSchema,
  type CloseTillFormValues,
  type OpenTillFormValues,
  type PosNewCustomerFormValues,
} from "@/lib/validations/pos";

type Product = {
  id: string;
  sku: string;
  name: string;
  tax_rate?: string;
  price?: string;
  barcode?: string;
  image_url?: string;
  product_kind?: string;
  duration_minutes?: number | null;
  variants?: {
    id: string;
    name: string;
    barcode?: string;
    price_override?: string;
  }[];
  modifier_groups?: {
    id: string;
    name: string;
    required?: boolean;
    min_select?: number;
    max_select?: number;
    modifiers: { id: string; name: string; price_delta: string }[];
  }[];
};

type CartLine = {
  product: Product;
  quantity: number;
  unit_price: number;
  variant_id?: string;
  variant_name?: string;
  modifier_ids?: string[];
  modifier_labels?: string[];
};

type Till = {
  id: string;
  status: string;
  opening_cash: string;
  over_short?: string | null;
};

type PayMethod = "cash" | "card" | "wallet" | "credit";

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  credit_enabled?: boolean;
  loyalty_points?: number;
};


const MAX_LINE_QTY = 99_999;
const PRODUCT_PAGE_SIZE = 100;

function CartQtyInput({
  quantity,
  onCommit,
}: {
  quantity: number;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(String(quantity));

  useEffect(() => {
    setText(String(quantity));
  }, [quantity]);

  function commitRaw(raw: string) {
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n) || n <= 0) {
      setText(String(quantity));
      return;
    }
    onCommit(Math.min(n, MAX_LINE_QTY));
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      aria-label="Quantity"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/\D/g, "").slice(0, 5);
        setText(raw);
        if (raw === "") return;
        const n = Number.parseInt(raw, 10);
        if (Number.isFinite(n) && n > 0) {
          onCommit(Math.min(n, MAX_LINE_QTY));
        }
      }}
      onBlur={() => commitRaw(text)}
      onFocus={(e) => e.target.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className="h-8 w-14 rounded-md border border-border bg-card text-center text-sm font-bold tabular-nums text-heading outline-none focus:border-brand/20"
    />
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

type PosT = (key: string, vars?: Record<string, string | number>) => string;

function formatCouponValidateError(err: unknown, t: PosT): string {
  const raw = err instanceof Error ? err.message : String(err);
  const reason = raw.includes(":") ? raw.split(":").pop()! : raw;
  switch (reason) {
    case "outside_validity":
      return t("pos.couponOutsideValidity");
    case "inactive":
      return t("pos.couponInactive");
    case "usage_limit_reached":
      return t("pos.couponUsageLimit");
    case "below_min_cart":
      return t("pos.couponBelowMinCart");
    case "not_stackable":
      return t("pos.couponNotStackable");
    case "not_found":
      return t("pos.couponNotFound");
    default:
      return t("pos.couponInvalid");
  }
}

function formatSaleError(err: unknown, t: PosT): string {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw.startsWith("payment_mismatch:")) {
    const [, expected, paid] = raw.split(":");
    return t("pos.paymentMismatch", {
      expected: expected || "—",
      paid: paid || "—",
    });
  }
  if (raw.startsWith("coupon_invalid:")) {
    return formatCouponValidateError(raw, t);
  }
  if (raw.includes("coupon_invalid") || raw.includes("outside_validity")) {
    return formatCouponValidateError(raw, t);
  }
  return raw || t("pos.checkoutFailed");
}

function productInitials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function PosPage() {
  const t = useT();
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [productsLoading, setProductsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const productSentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [till, setTill] = useState<Till | null>(null);
  const [payCash, setPayCash] = useState("");
  const [payCard, setPayCard] = useState("");
  const [payWallet, setPayWallet] = useState("");
  const [payKhata, setPayKhata] = useState("");
  const [payFocus, setPayFocus] = useState<PayMethod>("cash");
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptSale | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [loyaltyRedeem, setLoyaltyRedeem] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pickedVariant, setPickedVariant] = useState("");
  const [pickedModifiers, setPickedModifiers] = useState<string[]>([]);
  const [discountInput, setDiscountInput] = useState("");
  const [taxInput, setTaxInput] = useState("");

  const loadTill = useCallback(async () => {
    try {
      const res = await api<{ data: Till | null }>("/tills/current");
      setTill(res.data);
    } catch {
      setTill(null);
    }
  }, []);

  const loadProductPage = useCallback(
    async (opts: { reset: boolean; cursor?: string | null; q: string }) => {
      const { reset, q } = opts;
      if (reset) {
        setProductsLoading(true);
      } else {
        if (loadingMoreRef.current) return;
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }
      try {
        const params = new URLSearchParams();
        params.set("limit", String(PRODUCT_PAGE_SIZE));
        if (opts.cursor) params.set("cursor", opts.cursor);
        if (q) params.set("q", q);
        const res = await api<{
          data: Product[];
          meta?: { next_cursor?: string | null };
        }>(`/products?${params.toString()}`);
        const rows = res.data || [];
        setProducts((prev) => (reset ? rows : [...prev, ...rows]));
        setNextCursor(res.meta?.next_cursor ?? null);
      } catch (err) {
        if (reset) setProducts([]);
        toast.error(err instanceof Error ? err.message : t("common.loadFailed"));
      } finally {
        setProductsLoading(false);
        setLoadingMore(false);
        loadingMoreRef.current = false;
      }
    },
    [t, toast]
  );

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => window.clearTimeout(id);
  }, [query]);

  useEffect(() => {
    void loadProductPage({ reset: true, q: debouncedQ });
  }, [debouncedQ, loadProductPage]);

  useEffect(() => {
    apiAllPages<Customer>("/customers")
      .then((data) => setCustomers(data))
      .catch(() => setCustomers([]));
    loadTill();
  }, [loadTill]);

  useEffect(() => {
    const el = productSentinelRef.current;
    if (!el || !nextCursor) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && nextCursor && !loadingMoreRef.current) {
          void loadProductPage({ reset: false, cursor: nextCursor, q: debouncedQ });
        }
      },
      { root: el.parentElement, rootMargin: "120px", threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [nextCursor, debouncedQ, loadProductPage, products.length]);

  const selectedCustomer = customers.find((c) => c.id === customerId) || null;
  const filteredCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q)
    );
  }, [customers, customerQuery]);
  const filtered = products;

  function cartLineKey(line: CartLine) {
    return [
      line.product.id,
      line.variant_id || "",
      ...(line.modifier_ids || []).slice().sort(),
    ].join(":");
  }

  function resolveUnitPrice(product: Product, variantId?: string, modifierIds: string[] = []) {
    let base = Number(product.price || 0);
    const variant = product.variants?.find((v) => v.id === variantId);
    if (variant?.price_override) base = Number(variant.price_override);
    const groups = product.modifier_groups || [];
    const deltas = groups
      .flatMap((g) => g.modifiers)
      .filter((m) => modifierIds.includes(m.id))
      .reduce((s, m) => s + Number(m.price_delta || 0), 0);
    return base + deltas;
  }

  function commitToCart(
    product: Product,
    variantId?: string,
    modifierIds: string[] = []
  ) {
    const variant = product.variants?.find((v) => v.id === variantId);
    const labels = (product.modifier_groups || [])
      .flatMap((g) => g.modifiers)
      .filter((m) => modifierIds.includes(m.id))
      .map((m) => m.name);
    const unit_price = resolveUnitPrice(product, variantId, modifierIds);
    const draft: CartLine = {
      product,
      quantity: 1,
      unit_price,
      variant_id: variantId,
      variant_name: variant?.name,
      modifier_ids: modifierIds,
      modifier_labels: labels,
    };
    setCart((prev) => {
      const key = cartLineKey(draft);
      const existing = prev.find((l) => cartLineKey(l) === key);
      if (existing) {
        return prev.map((l) =>
          cartLineKey(l) === key ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, draft];
    });
  }

  function addProduct(product: Product) {
    const needsVariant = (product.variants || []).length > 0;
    const needsMods = (product.modifier_groups || []).some(
      (g) => g.required || (g.min_select || 0) > 0
    );
    if (needsVariant || needsMods) {
      setPendingProduct(product);
      setPickedVariant(product.variants?.[0]?.id || "");
      setPickedModifiers([]);
      return;
    }
    commitToCart(product);
  }

  async function lookupBarcode(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    try {
      const res = await api<{ data: Product & { matched_variant_id?: string } }>(
        `/products/by-barcode/${encodeURIComponent(trimmed)}`
      );
      const product = res.data;
      if (product.matched_variant_id) {
        commitToCart(product, product.matched_variant_id);
      } else {
        addProduct(product);
      }
      setQuery("");
      toast.info(`${t("common.create")}: ${product.name}`);
    } catch {
      // fall through to text filter
    }
  }

  function setQty(productKey: string, quantity: number) {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setCart((prev) => prev.filter((l) => cartLineKey(l) !== productKey));
      return;
    }
    const next = Math.min(Math.max(Math.floor(quantity), 1), MAX_LINE_QTY);
    setCart((prev) =>
      prev.map((l) => (cartLineKey(l) === productKey ? { ...l, quantity: next } : l))
    );
  }

  function removeLine(productKey: string) {
    setCart((prev) => prev.filter((l) => cartLineKey(l) !== productKey));
  }

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const discount = round2(Math.min(Math.max(Number(discountInput || 0), 0), subtotal));
  const tax = round2(Math.max(Number(taxInput || 0), 0));
  /** Matches BE `money.total_amount` before coupon (POS-FR-019). */
  const preCouponTotal = round2(subtotal - discount + tax);
  const total = round2(Math.max(0, preCouponTotal - couponDiscount));

  useEffect(() => {
    const code = couponCode.trim();
    if (!code) {
      setCouponDiscount(0);
      setCouponError(null);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api<{ data: { discount: string } }>("/crm/coupons/validate", {
            method: "POST",
            body: JSON.stringify({
              code,
              cart_total: formatDecimal(preCouponTotal),
            }),
          });
          if (cancelled) return;
          setCouponDiscount(round2(Number(res.data.discount || 0)));
          setCouponError(null);
        } catch (err) {
          if (cancelled) return;
          setCouponDiscount(0);
          setCouponError(formatCouponValidateError(err, t));
        }
      })();
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [couponCode, preCouponTotal, t]);

  useEffect(() => {
    setPayCash(formatDecimal(total));
    setPayCard("");
    setPayWallet("");
    setPayKhata("");
    setPayFocus("cash");
  }, [total]);

  function setPayMethod(method: PayMethod) {
    setPayFocus(method);
    setPayCash(method === "cash" ? formatDecimal(total) : "");
    setPayCard(method === "card" ? formatDecimal(total) : "");
    setPayWallet(method === "wallet" ? formatDecimal(total) : "");
    setPayKhata(method === "credit" ? formatDecimal(total) : "");
  }

  function buildPayments() {
    const parts: { method: PayMethod; amount: number }[] = [];
    const cash = Number(payCash || 0);
    const card = Number(payCard || 0);
    const wallet = Number(payWallet || 0);
    const khata = Number(payKhata || 0);
    if (cash > 0) parts.push({ method: "cash", amount: round2(cash) });
    if (card > 0) parts.push({ method: "card", amount: round2(card) });
    if (wallet > 0) parts.push({ method: "wallet", amount: round2(wallet) });
    if (khata > 0) parts.push({ method: "credit", amount: round2(khata) });
    return parts;
  }

  async function createCustomerQuick(values: PosNewCustomerFormValues) {
    setBusy(true);
    try {
      const res = await api<{ data: Customer }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: values.name.trim(),
          phone: values.phone.trim() || undefined,
          credit_enabled: true,
        }),
      });
      setCustomers((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setCustomerId(res.data.id);
      setShowNewCustomer(false);
      setCustomerModalOpen(false);
      setCustomerQuery("");
      toast.success(t("pos.customerCreatedKhata"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function enableKhata() {
    if (!customerId) return;
    try {
      const res = await api<{ data: Customer }>(`/customers/${customerId}`, {
        method: "PATCH",
        body: JSON.stringify({ credit_enabled: true }),
      });
      setCustomers((prev) => prev.map((c) => (c.id === res.data.id ? res.data : c)));
      toast.success(t("customers.enableKhata"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }
  async function openTill(values: OpenTillFormValues) {
    const session = getSession();
    if (!session?.branch_id) {
      toast.warning(t("tenant.noBranches"));
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ data: Till }>("/tills/open", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session.branch_id,
          opening_cash: values.opening_cash || "0",
        }),
      });
      setTill(res.data);
      toast.success(t("pos.tillOpen"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pos.tillOpenFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function closeTill(values: CloseTillFormValues) {
    if (!till?.id) return;
    setBusy(true);
    try {
      const res = await api<{ data: Till }>(`/tills/${till.id}/close`, {
        method: "POST",
        body: JSON.stringify({ closing_cash: values.closing_cash || "0" }),
      });
      setTill(null);
      const over = res.data.over_short;
      toast.success(
        over && Number(over) !== 0
          ? `${t("pos.tillClosed")} (${over})`
          : t("pos.tillClosed")
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("pos.tillCloseFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    const session = getSession();
    if (!session?.branch_id) {
      toast.warning(t("tenant.noBranches"));
      return;
    }

    let payableTotal = total;
    const code = couponCode.trim();
    if (code) {
      try {
        const res = await api<{ data: { discount: string } }>("/crm/coupons/validate", {
          method: "POST",
          body: JSON.stringify({
            code,
            cart_total: formatDecimal(preCouponTotal),
          }),
        });
        const quoted = round2(Number(res.data.discount || 0));
        setCouponDiscount(quoted);
        setCouponError(null);
        payableTotal = round2(Math.max(0, preCouponTotal - quoted));
      } catch (err) {
        const msg = formatCouponValidateError(err, t);
        setCouponDiscount(0);
        setCouponError(msg);
        toast.error(msg);
        return;
      }
    }

    const payments = buildPayments();
    let paySum = round2(payments.reduce((s, p) => s + p.amount, 0));
    // Coupon can change the due amount after payments were filled — sync single-method tenders.
    if (payments.length === 1 && Math.abs(paySum - payableTotal) > 0.001) {
      payments[0].amount = payableTotal;
      paySum = payableTotal;
      if (payments[0].method === "cash") setPayCash(formatDecimal(payableTotal));
      if (payments[0].method === "card") setPayCard(formatDecimal(payableTotal));
      if (payments[0].method === "wallet") setPayWallet(formatDecimal(payableTotal));
      if (payments[0].method === "credit") setPayKhata(formatDecimal(payableTotal));
    }
    if (payments.length === 0 || Math.abs(paySum - payableTotal) > 0.001) {
      toast.warning(
        `${t("common.total")}: ${formatDecimal(payableTotal)} / ${formatDecimal(paySum)}`
      );
      return;
    }
    const khataAmt = payments.find((p) => p.method === "credit")?.amount || 0;
    if (khataAmt > 0) {
      if (!customerId) {
        toast.warning(t("pos.selectCustomerKhata"));
        return;
      }
      if (!selectedCustomer?.credit_enabled) {
        toast.warning(t("pos.enableKhataFirst"));
        return;
      }
    }
    setBusy(true);
    try {
      const client_txn_id = crypto.randomUUID();
      const res = await api<{ data: ReceiptSale }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session.branch_id,
          client_txn_id,
          till_id: till?.id,
          customer_id: customerId || undefined,
          loyalty_redeem_points: loyaltyRedeem ? Number(loyaltyRedeem) : undefined,
          coupon_code: code || undefined,
          items: cart.map((l) => ({
            product_id: l.product.id,
            quantity: l.quantity,
            variant_id: l.variant_id,
            modifier_ids: l.modifier_ids || [],
          })),
          discount_amount: discount,
          tax_amount: tax,
          payments,
        }),
      });
      setCart([]);
      setLoyaltyRedeem("");
      setCouponCode("");
      setCouponDiscount(0);
      setCouponError(null);
      setCheckoutModalOpen(false);
      setLastInvoice(res.data.invoice_number);
      setReceipt(res.data);
      toast.success(`${t("pos.saleComplete")} · ${res.data.invoice_number}`);
    } catch (err) {
      toast.error(formatSaleError(err, t));
    } finally {
      setBusy(false);
    }
  }

  function openCheckout() {
    if (cart.length === 0) return;
    setPayMethod(payFocus === "credit" && !selectedCustomer ? "cash" : payFocus);
    setCheckoutModalOpen(true);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
      {/* Catalog */}
      <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-primary p-4 sm:p-6">
        <div className="flex shrink-0 flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
              {t("nav.cashier")}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-2xl font-bold text-heading">{t("pages.posTitle")}</h1>
              <InfoButton topicId="page.pos" size="md" />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {till ? (
              <CustomForm
                initialValues={emptyCloseTillForm()}
                validationSchema={closeTillFormSchema}
                onSubmit={closeTill}
                className="flex flex-wrap items-center gap-3 rounded-md border border-success/20 bg-success-soft/60 px-3 py-2.5 shadow-sm"
              >
                {({ values, setFieldValue }) => (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-success/15 text-success">
                        <Banknote className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-success">
                          {t("pos.tillOpenLabel")}
                        </p>
                        <p className="text-sm font-semibold tabular-nums text-heading">
                          {t("pos.floatAmount", {
                            amount: formatDecimal(till.opening_cash),
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-success/20 max-sm:hidden" aria-hidden />
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {t("pos.closingCash")}
                      </span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                          Rs
                        </span>
                        <input
                          name="closing_cash"
                          value={values.closing_cash}
                          onChange={(e) =>
                            void setFieldValue("closing_cash", e.target.value)
                          }
                          onBlur={(e) => {
                            if (e.target.value.trim() === "") return;
                            void setFieldValue(
                              "closing_cash",
                              formatDecimal(e.target.value)
                            );
                          }}
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={t("pos.closingCash")}
                          className={`${fieldClass} h-9 w-[7.5rem] pl-8 text-sm font-semibold tabular-nums`}
                        />
                      </div>
                    </label>
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className="self-end"
                    >
                      {t("pos.closeTill")}
                    </Button>
                  </>
                )}
              </CustomForm>
            ) : (
              <CustomForm
                initialValues={emptyOpenTillForm()}
                validationSchema={openTillFormSchema}
                onSubmit={openTill}
                className="flex flex-wrap items-center gap-3 rounded-md border border-warning/25 bg-warning-soft/70 px-3 py-2.5 shadow-sm"
              >
                {({ values, setFieldValue }) => (
                  <>
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-warning/15 text-warning">
                        <Banknote className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-warning">
                          {t("pos.tillClosedLabel")}
                        </p>
                        <p className="text-xs text-muted">{t("pos.enterOpeningFloat")}</p>
                      </div>
                    </div>
                    <div className="h-8 w-px bg-warning/25 max-sm:hidden" aria-hidden />
                    <label className="flex flex-col gap-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                        {t("pos.openingCash")}
                      </span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted">
                          Rs
                        </span>
                        <input
                          name="opening_cash"
                          value={values.opening_cash}
                          onChange={(e) =>
                            void setFieldValue("opening_cash", e.target.value)
                          }
                          onBlur={(e) => {
                            if (e.target.value.trim() === "") return;
                            void setFieldValue(
                              "opening_cash",
                              formatDecimal(e.target.value)
                            );
                          }}
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          placeholder="0.00"
                          aria-label={t("pos.openingCash")}
                          className={`${fieldClass} h-9 w-[7.5rem] border-warning/30 bg-bg-elevated pl-8 text-sm font-semibold tabular-nums`}
                        />
                      </div>
                    </label>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={busy}
                      startIcon={<Banknote className="h-3.5 w-3.5" />}
                      className="self-end"
                    >
                      {t("pos.openTill")}
                    </Button>
                  </>
                )}
              </CustomForm>
            )}
            {lastInvoice ? (
              <StatusBadge tone="success">
                {t("pos.lastInvoice")} · {lastInvoice}
              </StatusBadge>
            ) : null}
          </div>
        </div>

        <div className="relative mt-5 shrink-0">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                lookupBarcode(query);
              }
            }}
            placeholder="Scan barcode or search SKU / name"
            className={`${fieldClass} pl-10`}
          />
        </div>

        <div className="mt-4 flex shrink-0 items-center justify-between text-sm">
          <p className="font-medium text-body">
            {productsLoading
              ? t("common.loading")
              : `${filtered.length} products${nextCursor ? "+" : ""}`}
          </p>
        </div>

        <div className="relative mt-3 grid min-h-0 flex-1 auto-rows-max grid-cols-2 content-start gap-3 overflow-y-auto overscroll-contain py-4 sm:grid-cols-3 xl:grid-cols-4">
          {productsLoading ? (
            <div className="col-span-full flex flex-1 items-center justify-center py-16 text-muted">
              <Loader2 className="h-8 w-8 animate-spin text-brand" aria-label={t("common.loading")} />
            </div>
          ) : (
            <>
              {filtered.map((p) => {
            const inCart = cart.find((l) => l.product.id === p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className={`group rounded-md border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md ${inCart
                  ? "border-brand bg-brand-light ring-2 ring-brand/20"
                  : "border-border"
                  }`}
              >
                <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-md bg-brand-soft text-sm font-bold text-brand">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    productInitials(p.name)
                  )}
                </div>
                <div className="mt-3 font-semibold text-heading group-hover:text-brand">
                  {p.name}
                </div>
                <div className="mt-0.5 text-xs text-muted">{p.sku}</div>
                <div className="mt-3 flex items-end justify-between">
                  <span className="text-base font-bold text-heading">
                    Rs {formatDecimal(p.price)}
                  </span>
                  {inCart ? (
                    <StatusBadge tone="info">×{inCart.quantity}</StatusBadge>
                  ) : null}
                </div>
              </button>
            );
          })}
              <div ref={productSentinelRef} className="col-span-full flex justify-center py-3">
                {loadingMore ? (
                  <Loader2 className="h-5 w-5 animate-spin text-brand" aria-label={t("common.loading")} />
                ) : null}
              </div>
            </>
          )}
        </div>
      </section>

      {/* Order panel */}
      <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden border-t border-border bg-card max-lg:max-h-[48%] lg:h-full lg:w-[400px] lg:border-l lg:border-t-0 xl:w-[420px]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="text-lg font-bold text-heading">Order detail</h2>
          <span className="text-xs font-medium text-muted">
            {cart.length} line{cart.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
          {cart.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
              <p className="font-semibold text-heading">Cart is empty</p>
              <p className="mt-1 text-sm text-body">Tap a product to start the sale.</p>
            </div>
          ) : (
            cart.map((l) => {
              const key = cartLineKey(l);
              return (
                <div
                  key={key}
                  className="rounded-md border border-border bg-bg-secondary p-3"
                >
                  <div className="flex gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-brand-soft text-xs font-bold text-brand">
                      {l.product.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={l.product.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        productInitials(l.product.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="truncate font-semibold text-heading">
                            {l.product.name}
                            {l.variant_name ? ` · ${l.variant_name}` : ""}
                          </p>
                          {l.modifier_labels?.length ? (
                            <p className="text-xs text-muted">{l.modifier_labels.join(", ")}</p>
                          ) : null}
                          <p className="text-xs text-muted">
                            Rs {formatDecimal(l.unit_price)} each
                            {l.product.duration_minutes
                              ? ` · ${l.product.duration_minutes} min`
                              : ""}
                          </p>
                        </div>
                        <strong className="text-sm text-heading">
                          {formatDecimal(l.quantity * l.unit_price)}
                        </strong>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card hover:border-brand"
                          onClick={() => setQty(key, l.quantity - 1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <CartQtyInput
                          quantity={l.quantity}
                          onCommit={(n) => setQty(key, n)}
                        />
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card hover:border-brand"
                          onClick={() => setQty(key, l.quantity + 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="ml-auto rounded-md p-2 text-muted hover:bg-danger-soft hover:text-danger"
                          onClick={() => removeLine(key)}
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex min-h-0 shrink-0 flex-col border-t border-border bg-card">
          <div className="min-h-0 max-h-[min(42vh,22rem)] space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-body">
                <span>{t("common.subtotal")}</span>
                <strong className="text-heading">{formatDecimal(subtotal)}</strong>
              </div>
              <div className="flex justify-between text-body">
                <span>{t("common.tax")}</span>
                <strong className="text-heading">{formatDecimal(tax)}</strong>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted">
                  {t("pos.discount")}
                  <input
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value.trim() === "") return;
                      setDiscountInput(formatDecimal(e.target.value));
                    }}
                    className={`${fieldClass} mt-1`}
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0"
                  />
                </label>
                <label className="text-xs text-muted">
                  {t("pos.coupon")}
                  <input
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    className={`${fieldClass} mt-1`}
                    placeholder="CODE"
                  />
                </label>
              </div>
              {couponDiscount > 0 ? (
                <div className="flex justify-between text-body">
                  <span>{t("pos.couponDiscount")}</span>
                  <strong className="text-heading">−{formatDecimal(couponDiscount)}</strong>
                </div>
              ) : null}
              {couponError ? (
                <p className="text-xs text-danger">{couponError}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted">
                  {t("pos.taxOptional")}
                  <input
                    value={taxInput}
                    onChange={(e) => setTaxInput(e.target.value)}
                    onBlur={(e) => {
                      if (e.target.value.trim() === "") return;
                      setTaxInput(formatDecimal(e.target.value));
                    }}
                    className={`${fieldClass} mt-1`}
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0"
                  />
                </label>
              </div>
              <div className="flex items-end justify-between pt-1">
                <span className="text-base font-semibold text-heading">{t("pos.totalBill")}</span>
                <strong className="text-2xl font-bold text-heading">Rs {formatDecimal(total)}</strong>
              </div>
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("pos.customerKhata")}
              </p>
              {selectedCustomer ? (
                <div className="rounded-md border border-brand bg-brand-soft p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-brand/15 text-sm font-bold text-brand">
                        {selectedCustomer.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-heading">{selectedCustomer.name}</p>
                        <p className="mt-0.5 text-xs text-body">
                          {selectedCustomer.phone || "No phone"}
                          {" · "}
                          {selectedCustomer.loyalty_points ?? 0} {t("customers.points")}
                          {selectedCustomer.credit_enabled ? ` · ${t("pos.khata")}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="rounded-md p-1 text-muted hover:bg-card hover:text-heading"
                      aria-label={t("pos.clear")}
                      onClick={() => {
                        setCustomerId("");
                        setLoyaltyRedeem("");
                        if (payFocus === "credit") setPayMethod("cash");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCustomerQuery("");
                        setShowNewCustomer(false);
                        setCustomerModalOpen(true);
                      }}
                    >
                      {t("pos.changeCustomer")}
                    </Button>
                    {!selectedCustomer.credit_enabled ? (
                      <Button size="sm" variant="secondary" onClick={() => void enableKhata()}>
                        {t("pos.startKhata")}
                      </Button>
                    ) : null}
                    <label className="ml-auto flex items-center gap-1.5 text-xs text-body">
                      {t("pos.redeemPts")}
                      <input
                        className="w-16 rounded-md border border-border bg-card px-2 py-1 text-heading"
                        value={loyaltyRedeem}
                        onChange={(e) => setLoyaltyRedeem(e.target.value)}
                        placeholder="0"
                        inputMode="numeric"
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setCustomerQuery("");
                    setShowNewCustomer(false);
                    setCustomerModalOpen(true);
                  }}
                  startIcon={<UserRoundPlus className="h-4 w-4" />}
                >
                  {t("pos.attachCustomer")}
                </Button>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-border px-5 py-3">
            <Button
              className="w-full py-3.5 text-base"
              disabled={cart.length === 0 || busy}
              onClick={openCheckout}
            >
              {t("pos.proceedCheckout")} →
            </Button>
          </div>
        </div>
      </aside>

      <Modal
        isOpen={checkoutModalOpen}
        onClose={() => {
          if (!busy) setCheckoutModalOpen(false);
        }}
        title={t("pos.checkoutTitle")}
        description={t("pos.checkoutDesc")}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setCheckoutModalOpen(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button loading={busy} disabled={busy || cart.length === 0} onClick={() => void checkout()}>
              {busy ? t("pos.processing") : `${t("pos.placeOrder")} →`}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex items-end justify-between rounded-md border border-border bg-bg-tertiary/50 px-4 py-3">
            <span className="text-sm font-medium text-body">{t("pos.totalBill")}</span>
            <strong className="text-xl font-bold text-heading">Rs {formatDecimal(total)}</strong>
          </div>
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("pos.paymentMethod")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["cash", t("pos.cash"), Banknote],
                  ["card", t("pos.card"), CreditCard],
                  ["wallet", t("pos.wallet"), Wallet],
                  ["credit", t("pos.khata"), BookUser],
                ] as const
              ).map(([method, label, Icon]) => {
                const active = payFocus === method;
                const khataLocked = method === "credit" && !selectedCustomer;
                return (
                  <button
                    key={method}
                    type="button"
                    disabled={khataLocked}
                    title={khataLocked ? t("pos.khataNeedsCustomer") : undefined}
                    onClick={() => setPayMethod(method)}
                    className={`flex items-center gap-2.5 rounded-md border px-3 py-3 text-left transition ${active
                      ? "border-brand bg-brand text-white shadow-sm"
                      : khataLocked
                        ? "cursor-not-allowed border-border bg-bg-tertiary text-muted opacity-60"
                        : "border-border bg-card text-heading hover:border-brand/40 hover:bg-brand-light/40"
                      }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${active ? "bg-white/20" : "bg-bg-tertiary"
                        }`}
                    >
                      <Icon className={`h-4 w-4 ${active ? "text-white" : "text-brand"}`} />
                    </span>
                    <span className="text-sm font-semibold">{label}</span>
                  </button>
                );
              })}
            </div>
            <label className="block text-xs font-medium text-body">
              {t("pos.amountPaid")} ·{" "}
              <span className="text-heading">
                {payFocus === "cash"
                  ? t("pos.cash")
                  : payFocus === "card"
                    ? t("pos.card")
                    : payFocus === "wallet"
                      ? t("pos.wallet")
                      : t("pos.khata")}
              </span>
              <input
                value={
                  payFocus === "cash"
                    ? payCash
                    : payFocus === "card"
                      ? payCard
                      : payFocus === "wallet"
                        ? payWallet
                        : payKhata
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (payFocus === "cash") setPayCash(v);
                  else if (payFocus === "card") setPayCard(v);
                  else if (payFocus === "wallet") setPayWallet(v);
                  else setPayKhata(v);
                }}
                onBlur={(e) => {
                  if (e.target.value.trim() === "") return;
                  const v = formatDecimal(e.target.value);
                  if (payFocus === "cash") setPayCash(v);
                  else if (payFocus === "card") setPayCard(v);
                  else if (payFocus === "wallet") setPayWallet(v);
                  else setPayKhata(v);
                }}
                className={`${fieldClass} mt-1.5 text-base font-semibold tabular-nums`}
                type="number"
                step="0.01"
                inputMode="decimal"
                placeholder={formatDecimal(total)}
              />
            </label>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={customerModalOpen}
        onClose={() => {
          setCustomerModalOpen(false);
          setShowNewCustomer(false);
        }}
        title={t("pos.selectCustomerTitle")}
        description={t("pos.selectCustomerDesc")}
        size="md"
        footer={
          <div className="flex justify-between gap-2">
            <Button
              variant="outline"
              onClick={() => setShowNewCustomer((v) => !v)}
              startIcon={<BookUser className="h-4 w-4" />}
            >
              {t("pos.newCustomer")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCustomerModalOpen(false);
                setShowNewCustomer(false);
              }}
            >
              {t("common.cancel")}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              className={`${fieldClass} pl-9`}
              placeholder={t("pos.searchCustomer")}
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              autoFocus
            />
          </div>

          {showNewCustomer ? (
            <CustomForm
              initialValues={emptyPosNewCustomerForm()}
              validationSchema={posNewCustomerFormSchema}
              onSubmit={createCustomerQuick}
              className={`${formStackClass} rounded-md border border-border bg-bg-tertiary/50 p-3`}
            >
              {() => (
                <>
                  <FormikTextField name="name" placeholder="Name" required />
                  <FormikTextField name="phone" placeholder="Phone" />
                  <Button type="submit" size="sm" loading={busy}>
                    {t("pos.createStartKhata")}
                  </Button>
                </>
              )}
            </CustomForm>
          ) : null}

          <div className="max-h-72 space-y-2 overflow-y-auto pr-0.5">
            {filteredCustomers.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-body">
                {t("pos.noCustomersFound")}
              </p>
            ) : (
              filteredCustomers.map((c) => {
                const selected = customerId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerModalOpen(false);
                      setCustomerQuery("");
                      setShowNewCustomer(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-md border p-3.5 text-left transition ${selected
                        ? "border-brand bg-brand-soft shadow-sm"
                        : "border-border bg-card hover:border-brand/30"
                      }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-sm font-bold ${selected
                          ? "bg-brand/15 text-brand"
                          : "bg-bg-secondary text-heading"
                        }`}
                    >
                      {c.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-heading">
                        {c.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {c.phone || "—"}
                        {c.credit_enabled ? ` · ${t("pos.khata")}` : ""}
                        {" · "}
                        {c.loyalty_points ?? 0} pts
                      </span>
                    </span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${selected
                          ? "border-brand bg-brand text-white"
                          : "border-border bg-card text-transparent"
                        }`}
                      aria-hidden
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </Modal>

      {pendingProduct ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-overlay p-4 sm:items-center">
          <div className="w-full max-w-md rounded-md border border-border bg-card p-5 shadow-xl">
            <h3 className="text-lg font-bold text-heading">{pendingProduct.name}</h3>
            <p className="mt-1 text-sm text-body">Choose options before adding to cart.</p>
            {(pendingProduct.variants || []).length > 0 ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Variant</p>
                <div className="flex flex-wrap gap-2">
                  {pendingProduct.variants!.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setPickedVariant(v.id)}
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${pickedVariant === v.id
                        ? "bg-brand text-white"
                        : "bg-bg-tertiary text-heading"
                        }`}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {(pendingProduct.modifier_groups || []).map((g) => (
              <div key={g.id} className="mt-4 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {g.name}
                  {g.required ? " *" : ""}
                </p>
                <div className="flex flex-wrap gap-2">
                  {g.modifiers.map((m) => {
                    const on = pickedModifiers.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setPickedModifiers((prev) =>
                            on ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                          )
                        }
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold ${on ? "bg-brand text-white" : "bg-bg-tertiary text-heading"
                          }`}
                      >
                        {m.name}
                        {Number(m.price_delta) > 0 ? ` +${formatDecimal(m.price_delta)}` : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setPendingProduct(null)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  commitToCart(
                    pendingProduct,
                    pickedVariant || undefined,
                    pickedModifiers
                  );
                  setPendingProduct(null);
                }}
              >
                Add to cart
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <SaleReceiptModal sale={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
