"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, getSession } from "@/lib/api/client";

type Product = {
  id: string;
  sku: string;
  name: string;
  tax_rate?: string;
  price?: string;
};

type CartLine = {
  product: Product;
  quantity: number;
  unit_price: number;
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
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);

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
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, query]);

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
  }, [total]);

  function addProduct(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [
        ...prev,
        { product, quantity: 1, unit_price: Number(product.price || 0) },
      ];
    });
  }

  function setQty(productId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((l) => l.product.id !== productId));
      return;
    }
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, quantity } : l))
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
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
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <section className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-heading">POS</h1>
          {lastInvoice ? (
            <span className="text-sm text-body">Last invoice: {lastInvoice}</span>
          ) : null}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Scan barcode or search SKU / name"
          className="mt-3 w-full rounded-lg border border-border px-3 py-2"
        />
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addProduct(p)}
              className="rounded-lg border border-border bg-brand-subtle p-3 text-left hover:border-brand"
            >
              <div className="font-semibold text-heading">{p.name}</div>
              <div className="text-xs text-body">{p.sku}</div>
              <div className="mt-1 text-sm text-heading">Rs {p.price ?? "0.00"}</div>
            </button>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold text-heading">Till</h2>
          {till ? (
            <div className="mt-2 space-y-2 text-sm text-heading">
              <p>
                Open · float Rs {till.opening_cash}
              </p>
              <div className="flex gap-2">
                <input
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder="Closing cash"
                  className="w-full rounded-lg border border-border px-3 py-2"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeTill}
                  className="shrink-0 rounded-lg border border-border px-3 py-2 font-medium hover:border-brand disabled:opacity-50"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex gap-2">
              <input
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="Opening cash"
                className="w-full rounded-lg border border-border px-3 py-2"
              />
              <button
                type="button"
                disabled={busy}
                onClick={openTill}
                className="shrink-0 rounded-lg bg-brand px-3 py-2 font-medium text-brand-foreground hover:bg-brand-hover disabled:opacity-50"
              >
                Open
              </button>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="font-semibold text-heading">Cart</h2>
          <ul className="mt-3 min-h-40 space-y-2 text-sm">
            {cart.length === 0 ? (
              <li className="text-body">Cart is empty</li>
            ) : (
              cart.map((l) => (
                <li key={l.product.id} className="space-y-1 text-heading">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{l.product.name}</span>
                    <strong>{money(l.quantity * l.unit_price)}</strong>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-0.5"
                      onClick={() => setQty(l.product.id, l.quantity - 1)}
                    >
                      −
                    </button>
                    <span className="w-8 text-center">{l.quantity}</span>
                    <button
                      type="button"
                      className="rounded border border-border px-2 py-0.5"
                      onClick={() => setQty(l.product.id, l.quantity + 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="ml-auto text-xs text-body underline"
                      onClick={() => removeLine(l.product.id)}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
          <div className="mt-4 space-y-1 text-sm text-heading">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Tax</span>
              <strong>{money(tax)}</strong>
            </div>
            <div className="flex justify-between text-lg">
              <span>Total</span>
              <strong>{money(total)}</strong>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-body">
              Split payment
            </p>
            {(
              [
                ["Cash", payCash, setPayCash],
                ["Card", payCard, setPayCard],
                ["Wallet", payWallet, setPayWallet],
              ] as const
            ).map(([label, value, setter]) => (
              <label key={label} className="flex items-center gap-2 text-sm text-heading">
                <span className="w-14">{label}</span>
                <input
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full rounded-lg border border-border px-3 py-1.5"
                  inputMode="decimal"
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            disabled={cart.length === 0 || busy}
            onClick={checkout}
            className="mt-4 w-full rounded-lg bg-brand px-4 py-3 font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-50"
          >
            {busy ? "Processing…" : "Charge"}
          </button>
          {message ? <p className="mt-3 text-sm text-body">{message}</p> : null}
        </section>
      </aside>
    </div>
  );
}
