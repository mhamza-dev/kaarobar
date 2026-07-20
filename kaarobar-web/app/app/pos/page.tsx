"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CreditCard,
  Minus,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { api, getSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import { Alert, StatusBadge, fieldClass } from "@/components/app/ui";

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

type PayMethod = "cash" | "card" | "wallet";

function money(n: number) {
  return n.toFixed(2);
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [till, setTill] = useState<Till | null>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [closingCash, setClosingCash] = useState("");
  const [payCash, setPayCash] = useState("");
  const [payCard, setPayCard] = useState("");
  const [payWallet, setPayWallet] = useState("");
  const [payFocus, setPayFocus] = useState<PayMethod>("cash");
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pickedVariant, setPickedVariant] = useState("");
  const [pickedModifiers, setPickedModifiers] = useState<string[]>([]);

  const loadTill = useCallback(async () => {
    try {
      const res = await api<{ data: Till | null }>("/tills/current");
      setTill(res.data);
    } catch {
      setTill(null);
    }
  }, []);

  useEffect(() => {
    api<{ data: Product[] }>("/products")
      .then((res) => setProducts(res.data || []))
      .catch((err) => setMessage(err.message));
    loadTill();
  }, [loadTill]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode || "").toLowerCase().includes(q)
    );
  }, [products, query]);

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
      setMessage(`Added ${product.name}`);
    } catch {
      // fall through to text filter
    }
  }

  function setQty(productKey: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => cartLineKey(l) !== productKey));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (cartLineKey(l) === productKey ? { ...l, quantity } : l))
    );
  }

  function removeLine(productKey: string) {
    setCart((prev) => prev.filter((l) => cartLineKey(l) !== productKey));
  }

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const tax = cart.reduce((s, l) => {
    const rate = Number(l.product.tax_rate || 0.18);
    return s + l.quantity * l.unit_price * rate;
  }, 0);
  const total = round2(subtotal + tax);

  useEffect(() => {
    setPayCash(money(total));
    setPayCard("");
    setPayWallet("");
    setPayFocus("cash");
  }, [total]);

  function setPayMethod(method: PayMethod) {
    setPayFocus(method);
    if (method === "cash") {
      setPayCash(money(total));
      setPayCard("");
      setPayWallet("");
    } else if (method === "card") {
      setPayCash("");
      setPayCard(money(total));
      setPayWallet("");
    } else {
      setPayCash("");
      setPayCard("");
      setPayWallet(money(total));
    }
  }

  function buildPayments() {
    const parts: { method: PayMethod; amount: number }[] = [];
    const cash = Number(payCash || 0);
    const card = Number(payCard || 0);
    const wallet = Number(payWallet || 0);
    if (cash > 0) parts.push({ method: "cash", amount: round2(cash) });
    if (card > 0) parts.push({ method: "card", amount: round2(card) });
    if (wallet > 0) parts.push({ method: "wallet", amount: round2(wallet) });
    return parts;
  }

  async function openTill() {
    const session = getSession();
    if (!session?.branch_id) {
      setMessage("Pick a branch from the dashboard first.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: Till }>("/tills/open", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session.branch_id,
          opening_cash: openingCash || "0",
        }),
      });
      setTill(res.data);
      setMessage("Till opened");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not open till");
    } finally {
      setBusy(false);
    }
  }

  async function closeTill() {
    if (!till?.id) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await api<{ data: Till }>(`/tills/${till.id}/close`, {
        method: "POST",
        body: JSON.stringify({ closing_cash: closingCash || "0" }),
      });
      setTill(null);
      setClosingCash("");
      const over = res.data.over_short;
      setMessage(
        over && Number(over) !== 0
          ? `Till closed (over/short ${over})`
          : "Till closed"
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not close till");
    } finally {
      setBusy(false);
    }
  }

  async function checkout() {
    const session = getSession();
    if (!session?.branch_id) {
      setMessage("Pick a branch from the dashboard first.");
      return;
    }
    const payments = buildPayments();
    const paySum = round2(payments.reduce((s, p) => s + p.amount, 0));
    if (payments.length === 0 || Math.abs(paySum - total) > 0.001) {
      setMessage(`Payments must total ${money(total)} (got ${money(paySum)})`);
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const client_txn_id = crypto.randomUUID();
      const res = await api<{
        data: { invoice_number: string; id: string };
      }>("/sales", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session.branch_id,
          client_txn_id,
          till_id: till?.id,
          items: cart.map((l) => ({
            product_id: l.product.id,
            quantity: l.quantity,
            variant_id: l.variant_id,
            modifier_ids: l.modifier_ids || [],
          })),
          payments,
        }),
      });
      setCart([]);
      setLastInvoice(res.data.invoice_number);
      setMessage(`Sale ${res.data.invoice_number}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:flex-row">
      {/* Catalog */}
      <section className="flex min-w-0 flex-1 flex-col bg-bg-primary p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
              Cashier
            </p>
            <h1 className="mt-1 text-2xl font-bold text-heading">Point of sale</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {lastInvoice ? (
              <StatusBadge tone="success">Last · {lastInvoice}</StatusBadge>
            ) : null}
            <StatusBadge tone={till ? "success" : "warning"}>
              {till ? `Till open · Rs ${till.opening_cash}` : "Till closed"}
            </StatusBadge>
          </div>
        </div>

        <div className="relative mt-5">
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

        <div className="mt-4 flex items-center justify-between text-sm">
          <p className="font-medium text-body">{filtered.length} products</p>
        </div>

        <div className="mt-3 grid flex-1 grid-cols-2 content-start gap-3 overflow-auto pb-4 sm:grid-cols-3 xl:grid-cols-4">
          {filtered.map((p) => {
            const inCart = cart.find((l) => l.product.id === p.id);
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduct(p)}
                className={`group rounded-md border bg-card p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md ${
                  inCart
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
                    Rs {p.price ?? "0.00"}
                  </span>
                  {inCart ? (
                    <StatusBadge tone="info">×{inCart.quantity}</StatusBadge>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Order panel */}
      <aside className="flex w-full flex-col border-t border-border bg-card lg:w-[400px] lg:border-l lg:border-t-0 xl:w-[420px]">
        <div className="border-b border-border px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-heading">Order detail</h2>
            <span className="text-xs font-medium text-muted">
              {cart.length} line{cart.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="mt-4 rounded-md bg-bg-tertiary p-3">
            {till ? (
              <div className="flex flex-wrap items-end gap-2">
                <input
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="Closing cash"
                  className={`${fieldClass} flex-1`}
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={closeTill}
                >
                  Close till
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <input
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="Opening cash"
                  className={`${fieldClass} flex-1`}
                />
                <Button size="sm" disabled={busy} onClick={openTill}>
                  Open till
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
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
                          Rs {money(l.unit_price)} each
                          {l.product.duration_minutes
                            ? ` · ${l.product.duration_minutes} min`
                            : ""}
                        </p>
                      </div>
                      <strong className="text-sm text-heading">
                        {money(l.quantity * l.unit_price)}
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
                      <span className="w-8 text-center text-sm font-bold">
                        {l.quantity}
                      </span>
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
            );})
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-body">
              <span>Subtotal</span>
              <strong className="text-heading">{money(subtotal)}</strong>
            </div>
            <div className="flex justify-between text-body">
              <span>Tax</span>
              <strong className="text-heading">{money(tax)}</strong>
            </div>
            <div className="flex items-end justify-between pt-1">
              <span className="text-base font-semibold text-heading">Total bill</span>
              <strong className="text-2xl font-bold text-heading">Rs {money(total)}</strong>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {(
              [
                ["cash", "Cash", Banknote, payCash, setPayCash],
                ["card", "Card", CreditCard, payCard, setPayCard],
                ["wallet", "Wallet", Wallet, payWallet, setPayWallet],
              ] as const
            ).map(([method, label, Icon, value, setter]) => (
              <button
                key={method}
                type="button"
                onClick={() => setPayMethod(method)}
                className={`rounded-md border px-2 py-3 text-center transition ${
                  payFocus === method
                    ? "border-brand bg-brand-light text-brand"
                    : "border-border bg-card text-body hover:border-brand/40"
                }`}
              >
                <Icon className="mx-auto h-4 w-4" />
                <span className="mt-1 block text-xs font-semibold">{label}</span>
                <input
                  value={value}
                  onChange={(e) => {
                    setPayFocus(method);
                    setter(e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-2 w-full rounded-md border border-border bg-white px-1.5 py-1 text-center text-xs text-heading outline-none focus:border-brand"
                  inputMode="decimal"
                />
              </button>
            ))}
          </div>

          <Button
            className="mt-4 w-full py-3.5 text-base"
            disabled={cart.length === 0 || busy}
            loading={busy}
            onClick={checkout}
          >
            {busy ? "Processing…" : "Place order →"}
          </Button>

          {message ? (
            <div className="mt-3">
              <Alert tone={message.startsWith("Sale") ? "success" : "info"}>
                {message}
              </Alert>
            </div>
          ) : null}
        </div>
      </aside>

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
                      className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                        pickedVariant === v.id
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
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                          on ? "bg-brand text-white" : "bg-bg-tertiary text-heading"
                        }`}
                      >
                        {m.name}
                        {Number(m.price_delta) > 0 ? ` +${m.price_delta}` : ""}
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
    </div>
  );
}
