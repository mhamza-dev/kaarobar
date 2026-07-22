"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { api, getSession, isConsumerSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";

type Product = {
  id: string;
  name: string;
  sku?: string;
  price?: string | null;
  image_url?: string | null;
};

type CartLine = { product: Product; quantity: number; unit_price: number };

function money(n: number) {
  return n.toFixed(2);
}

export default function MarketplaceStorePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [businessName, setBusinessName] = useState("");
  const [businessId, setBusinessId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<"card" | "wallet">("card");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const signedIn = isConsumerSession();

  useEffect(() => {
    void api<{
      data: {
        business: { id: string; name: string };
        products: Product[];
      };
    }>(`/marketplace/businesses/${id}/catalog`, {}, null)
      .then((res) => {
        setBusinessName(res.data.business.name);
        setBusinessId(res.data.business.id);
        setProducts(res.data.products || []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load store"));
  }, [id]);

  const total = useMemo(
    () => cart.reduce((s, l) => s + l.quantity * l.unit_price, 0),
    [cart]
  );

  function addProduct(p: Product) {
    const price = Number(p.price || 0);
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === p.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      return [...prev, { product: p, quantity: 1, unit_price: price }];
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

  async function checkout() {
    if (!getSession() || !isConsumerSession()) {
      router.push("/login?as=consumer");
      return;
    }
    if (cart.length === 0 || !businessId) return;
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await api<{ data: { invoice_number: string; total_amount: string } }>(
        "/portal/orders",
        {
          method: "POST",
          body: JSON.stringify({
            business_id: businessId,
            payment_method: payMethod,
            notes: notes.trim() || undefined,
            items: cart.map((l) => ({
              product_id: l.product.id,
              quantity: l.quantity,
            })),
          }),
        }
      );
      setCart([]);
      setMessage(`Order placed · ${res.data.invoice_number} · Rs ${res.data.total_amount}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="space-y-4">
        <div>
          <Link href="/app" className="text-sm text-brand hover:underline">
            ← All stores
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-heading">{businessName || "Store"}</h1>
          <p className="mt-1 text-sm text-body">Pickup / order-ahead · card or wallet</p>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addProduct(p)}
              className="rounded-xl border border-border bg-white p-4 text-left shadow-sm hover:border-brand/40"
            >
              <p className="font-semibold text-heading">{p.name}</p>
              <p className="mt-1 text-xs text-muted">{p.sku}</p>
              <p className="mt-3 font-bold text-heading">Rs {p.price || "0.00"}</p>
            </button>
          ))}
        </div>
      </section>

      <aside className="h-fit rounded-xl border border-border bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold text-heading">Cart</h2>
        {cart.length === 0 ? (
          <p className="mt-3 text-sm text-body">Tap products to add them.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {cart.map((l) => (
              <li key={l.product.id} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="font-medium text-heading">{l.product.name}</span>
                  <span>Rs {money(l.quantity * l.unit_price)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    type="button"
                    className="h-7 w-7 rounded border border-border"
                    onClick={() => setQty(l.product.id, l.quantity - 1)}
                  >
                    −
                  </button>
                  <input
                    className="h-7 w-14 rounded border border-border text-center text-sm font-bold"
                    value={l.quantity}
                    onChange={(e) => {
                      const n = Number.parseInt(e.target.value.replace(/\D/g, ""), 10);
                      if (Number.isFinite(n) && n > 0) setQty(l.product.id, n);
                    }}
                  />
                  <button
                    type="button"
                    className="h-7 w-7 rounded border border-border"
                    onClick={() => setQty(l.product.id, l.quantity + 1)}
                  >
                    +
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <label className="mt-4 block text-xs text-body">
          Notes / pickup instructions
          <textarea
            className="mt-1 w-full rounded-md border border-border px-2 py-1.5 text-sm"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <div className="mt-3 flex gap-2 text-sm">
          {(["card", "wallet"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setPayMethod(m)}
              className={`rounded-md px-3 py-1.5 capitalize ${
                payMethod === m
                  ? "bg-brand text-brand-foreground"
                  : "border border-border text-heading"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between font-bold text-heading">
          <span>Total</span>
          <span>Rs {money(total)}</span>
        </div>
        <Button
          className="mt-3 w-full"
          disabled={busy || cart.length === 0}
          loading={busy}
          onClick={() => void checkout()}
        >
          {signedIn ? "Place order" : "Sign in to order"}
        </Button>
      </aside>
    </div>
  );
}
