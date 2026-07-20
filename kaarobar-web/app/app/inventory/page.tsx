"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getSession } from "@/lib/api/client";

type Tab = "stock" | "products" | "suppliers" | "pos" | "transfers" | "adjust";

type Product = { id: string; sku: string; name: string; price?: string };
type StockRow = {
  product_id: string;
  sku?: string;
  name?: string;
  quantity_on_hand: string;
  avg_cost: string;
};
type Supplier = { id: string; name: string; payment_terms?: string };
type PO = {
  id: string;
  status: string;
  supplier_name?: string;
  supplier_id: string;
  items: { product_id: string; quantity: string; unit_cost: string }[];
};
type Transfer = {
  id: string;
  status: string;
  from_branch_id: string;
  to_branch_id: string;
  items: { product_id: string; quantity: string }[];
};

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [productForm, setProductForm] = useState({ sku: "", name: "", price: "" });
  const [supplierName, setSupplierName] = useState("");
  const [poForm, setPoForm] = useState({
    supplier_id: "",
    product_id: "",
    quantity: "10",
    unit_cost: "50",
  });
  const [grnForm, setGrnForm] = useState({
    purchase_order_id: "",
    product_id: "",
    quantity_received: "",
  });
  const [transferForm, setTransferForm] = useState({
    to_branch_id: "",
    product_id: "",
    quantity: "1",
  });
  const [adjustForm, setAdjustForm] = useState({
    product_id: "",
    quantity_delta: "",
    reason_code: "adjustment",
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, s, sup, poList, tr] = await Promise.all([
        api<{ data: Product[] }>("/products"),
        api<{ data: StockRow[] }>("/inventory").catch(() => ({ data: [] })),
        api<{ data: Supplier[] }>("/suppliers").catch(() => ({ data: [] })),
        api<{ data: PO[] }>("/inventory/purchase-orders").catch(() => ({ data: [] })),
        api<{ data: Transfer[] }>("/inventory/transfers").catch(() => ({ data: [] })),
      ]);
      setProducts(p.data || []);
      setStock(s.data || []);
      setSuppliers(sup.data || []);
      setPos(poList.data || []);
      setTransfers(tr.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/products", {
        method: "POST",
        body: JSON.stringify(productForm),
      });
      setProductForm({ sku: "", name: "", price: "" });
      setMessage("Product created");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  async function createSupplier(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/suppliers", {
        method: "POST",
        body: JSON.stringify({ name: supplierName }),
      });
      setSupplierName("");
      setMessage("Supplier added");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supplier failed");
    }
  }

  async function createPO(e: React.FormEvent) {
    e.preventDefault();
    const session = getSession();
    try {
      await api("/inventory/purchase-orders", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          supplier_id: poForm.supplier_id,
          items: [
            {
              product_id: poForm.product_id,
              quantity: poForm.quantity,
              unit_cost: poForm.unit_cost,
            },
          ],
        }),
      });
      setMessage("PO created");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PO failed");
    }
  }

  async function receiveGRN(e: React.FormEvent) {
    e.preventDefault();
    const session = getSession();
    try {
      await api("/inventory/grn", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          purchase_order_id: grnForm.purchase_order_id,
          items: [
            {
              product_id: grnForm.product_id,
              quantity_received: grnForm.quantity_received,
            },
          ],
        }),
      });
      setMessage("GRN received");
      setGrnForm({ purchase_order_id: "", product_id: "", quantity_received: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "GRN failed");
    }
  }

  async function createTransfer(e: React.FormEvent) {
    e.preventDefault();
    const session = getSession();
    try {
      await api("/inventory/transfers", {
        method: "POST",
        body: JSON.stringify({
          from_branch_id: session?.branch_id,
          to_branch_id: transferForm.to_branch_id,
          items: [
            {
              product_id: transferForm.product_id,
              quantity: transferForm.quantity,
            },
          ],
        }),
      });
      setMessage("Transfer created (pending confirm)");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    }
  }

  async function confirmTransfer(id: string) {
    try {
      await api(`/inventory/transfers/${id}/confirm`, { method: "POST", body: "{}" });
      setMessage("Transfer confirmed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Confirm failed");
    }
  }

  async function adjustStock(e: React.FormEvent) {
    e.preventDefault();
    const session = getSession();
    try {
      await api("/inventory/adjust", {
        method: "POST",
        body: JSON.stringify({
          branch_id: session?.branch_id,
          ...adjustForm,
        }),
      });
      setMessage("Stock adjusted");
      setAdjustForm({ product_id: "", quantity_delta: "", reason_code: "adjustment" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Adjust failed");
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "stock", label: "On hand" },
    { id: "products", label: "Products" },
    { id: "suppliers", label: "Suppliers" },
    { id: "pos", label: "PO / GRN" },
    { id: "transfers", label: "Transfers" },
    { id: "adjust", label: "Adjust" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Inventory</h1>
        <p className="text-body">Stock, suppliers, purchase orders, receipts, and transfers.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.id
                ? "bg-brand text-brand-foreground"
                : "border border-border text-heading hover:border-brand"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      {message ? <p className="text-sm text-body">{message}</p> : null}

      {tab === "stock" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-subtle">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">On hand</th>
                <th className="px-4 py-3">Avg cost</th>
              </tr>
            </thead>
            <tbody>
              {stock.map((row) => (
                <tr key={row.product_id} className="border-t border-border text-heading">
                  <td className="px-4 py-3">{row.sku}</td>
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3">{row.quantity_on_hand}</td>
                  <td className="px-4 py-3">{row.avg_cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {tab === "products" ? (
        <>
          <form
            onSubmit={createProduct}
            className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4"
          >
            <input
              className="rounded-lg border border-border px-3 py-2"
              placeholder="SKU"
              value={productForm.sku}
              onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
              required
            />
            <input
              className="rounded-lg border border-border px-3 py-2"
              placeholder="Name"
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              required
            />
            <input
              className="rounded-lg border border-border px-3 py-2"
              placeholder="Price"
              value={productForm.price}
              onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-foreground"
            >
              Add product
            </button>
          </form>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-subtle">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Price</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-t border-border text-heading">
                    <td className="px-4 py-3">{p.sku}</td>
                    <td className="px-4 py-3">{p.name}</td>
                    <td className="px-4 py-3">{p.price ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {tab === "suppliers" ? (
        <>
          <form onSubmit={createSupplier} className="flex gap-2">
            <input
              className="flex-1 rounded-lg border border-border px-3 py-2"
              placeholder="Supplier name"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-foreground"
            >
              Add
            </button>
          </form>
          <ul className="space-y-2 text-sm text-heading">
            {suppliers.map((s) => (
              <li key={s.id} className="rounded-lg border border-border bg-card px-4 py-3">
                {s.name}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {tab === "pos" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={createPO}
            className="space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <h2 className="font-semibold text-heading">New purchase order</h2>
            <select
              className="w-full rounded-lg border border-border px-3 py-2"
              value={poForm.supplier_id}
              onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
              required
            >
              <option value="">Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              className="w-full rounded-lg border border-border px-3 py-2"
              value={poForm.product_id}
              onChange={(e) => setPoForm({ ...poForm, product_id: e.target.value })}
              required
            >
              <option value="">Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                className="w-full rounded-lg border border-border px-3 py-2"
                placeholder="Qty"
                value={poForm.quantity}
                onChange={(e) => setPoForm({ ...poForm, quantity: e.target.value })}
              />
              <input
                className="w-full rounded-lg border border-border px-3 py-2"
                placeholder="Unit cost"
                value={poForm.unit_cost}
                onChange={(e) => setPoForm({ ...poForm, unit_cost: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-foreground"
            >
              Create PO
            </button>
          </form>

          <form
            onSubmit={receiveGRN}
            className="space-y-3 rounded-xl border border-border bg-card p-4"
          >
            <h2 className="font-semibold text-heading">Receive GRN</h2>
            <select
              className="w-full rounded-lg border border-border px-3 py-2"
              value={grnForm.purchase_order_id}
              onChange={(e) => {
                const po = pos.find((p) => p.id === e.target.value);
                setGrnForm({
                  purchase_order_id: e.target.value,
                  product_id: po?.items[0]?.product_id || "",
                  quantity_received: po?.items[0]?.quantity || "",
                });
              }}
              required
            >
              <option value="">Purchase order</option>
              {pos
                .filter((p) => p.status !== "received" && p.status !== "cancelled")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.supplier_name || p.id.slice(0, 8)} · {p.status}
                  </option>
                ))}
            </select>
            <input
              className="w-full rounded-lg border border-border px-3 py-2"
              placeholder="Qty received"
              value={grnForm.quantity_received}
              onChange={(e) =>
                setGrnForm({ ...grnForm, quantity_received: e.target.value })
              }
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-foreground"
            >
              Receive
            </button>
          </form>

          <div className="lg:col-span-2 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-subtle">
                <tr>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Lines</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((p) => (
                  <tr key={p.id} className="border-t border-border text-heading">
                    <td className="px-4 py-3">{p.supplier_name || p.supplier_id.slice(0, 8)}</td>
                    <td className="px-4 py-3">{p.status}</td>
                    <td className="px-4 py-3">{p.items?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "transfers" ? (
        <div className="space-y-4">
          <form
            onSubmit={createTransfer}
            className="grid gap-3 rounded-xl border border-border bg-card p-4 md:grid-cols-4"
          >
            <input
              className="rounded-lg border border-border px-3 py-2"
              placeholder="To branch ID"
              value={transferForm.to_branch_id}
              onChange={(e) =>
                setTransferForm({ ...transferForm, to_branch_id: e.target.value })
              }
              required
            />
            <select
              className="rounded-lg border border-border px-3 py-2"
              value={transferForm.product_id}
              onChange={(e) =>
                setTransferForm({ ...transferForm, product_id: e.target.value })
              }
              required
            >
              <option value="">Product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              className="rounded-lg border border-border px-3 py-2"
              placeholder="Qty"
              value={transferForm.quantity}
              onChange={(e) =>
                setTransferForm({ ...transferForm, quantity: e.target.value })
              }
            />
            <button
              type="submit"
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-foreground"
            >
              Create transfer
            </button>
          </form>
          <ul className="space-y-2">
            {transfers.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-heading"
              >
                <span>
                  {t.status} · {t.items?.[0]?.quantity || "?"} units
                </span>
                {t.status === "pending" ? (
                  <button
                    type="button"
                    onClick={() => confirmTransfer(t.id)}
                    className="rounded-lg bg-brand px-3 py-1.5 text-brand-foreground"
                  >
                    Confirm
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tab === "adjust" ? (
        <form
          onSubmit={adjustStock}
          className="grid max-w-xl gap-3 rounded-xl border border-border bg-card p-4"
        >
          <select
            className="rounded-lg border border-border px-3 py-2"
            value={adjustForm.product_id}
            onChange={(e) => setAdjustForm({ ...adjustForm, product_id: e.target.value })}
            required
          >
            <option value="">Product</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="rounded-lg border border-border px-3 py-2"
            placeholder="Qty delta (e.g. -2 or 5)"
            value={adjustForm.quantity_delta}
            onChange={(e) =>
              setAdjustForm({ ...adjustForm, quantity_delta: e.target.value })
            }
            required
          />
          <select
            className="rounded-lg border border-border px-3 py-2"
            value={adjustForm.reason_code}
            onChange={(e) => setAdjustForm({ ...adjustForm, reason_code: e.target.value })}
          >
            {["adjustment", "damage", "theft", "count_correction", "expired", "sample"].map(
              (r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              )
            )}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 font-semibold text-brand-foreground"
          >
            Apply adjustment
          </button>
        </form>
      ) : null}
    </div>
  );
}
