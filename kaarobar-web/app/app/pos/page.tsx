"use client";

import { useEffect, useMemo, useState } from "react";
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

function money(n: number) {
  return n.toFixed(2);
}

export default function PosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ data: Product[] }>("/products")
      .then((res) => setProducts(res.data || []))
      .catch((err) => setMessage(err.message));
  }, []);

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
  const total = subtotal + tax;

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

  async function checkout() {
    const session = getSession();
    if (!session?.branch_id) {
      setMessage("Select a branch context first from the dashboard.");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const client_txn_id = crypto.randomUUID();
      await api("/sales", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session.branch_id,
          client_txn_id,
          items: cart.map((l) => ({
            product_id: l.product.id,
            quantity: l.quantity,
            unit_price: l.unit_price,
          })),
          payments: [{ method: "cash", amount: total }],
        }),
      });
      setCart([]);
      setMessage(`Sale completed (${client_txn_id.slice(0, 8)}…)`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
      <section className="rounded-xl border border-border bg-card p-4">
        <h1 className="text-xl font-bold text-heading">POS</h1>
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

      <aside className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-semibold text-heading">Cart</h2>
        <ul className="mt-3 min-h-40 space-y-2 text-sm">
          {cart.length === 0 ? (
            <li className="text-body">Cart is empty</li>
          ) : (
            cart.map((l) => (
              <li key={l.product.id} className="flex justify-between text-heading">
                <span>
                  {l.product.name} × {l.quantity}
                </span>
                <strong>{money(l.quantity * l.unit_price)}</strong>
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
        <button
          type="button"
          disabled={cart.length === 0 || busy}
          onClick={checkout}
          className="mt-4 w-full rounded-lg bg-brand px-4 py-3 font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-50"
        >
          {busy ? "Processing…" : "Charge (cash)"}
        </button>
        {message ? <p className="mt-3 text-sm text-body">{message}</p> : null}
      </aside>
    </div>
  );
}
