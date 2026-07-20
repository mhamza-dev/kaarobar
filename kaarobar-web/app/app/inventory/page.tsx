"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getSession } from "@/lib/api/client";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import {
  Alert,
  EmptyState,
  Field,
  PageHeader,
  SurfaceCard,
  TabBar,
  fieldClass,
} from "@/components/app/ui";

type Tab = "stock" | "products" | "suppliers" | "pos" | "transfers" | "adjust";
type ModalKind = "product" | "supplier" | "po" | null;

type Product = { id: string; sku: string; name: string; price?: string };
type StockRow = {
  product_id: string;
  sku?: string;
  name?: string;
  quantity_on_hand: string;
  avg_cost: string;
};
type Supplier = { id: string; name: string };
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
  items: { product_id: string; quantity: string }[];
};

export default function InventoryPage() {
  const [tab, setTab] = useState<Tab>("stock");
  const [modal, setModal] = useState<ModalKind>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [stock, setStock] = useState<StockRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setBusy(true);
    setError(null);
    try {
      await api("/products", {
        method: "POST",
        body: JSON.stringify(productForm),
      });
      setProductForm({ sku: "", name: "", price: "" });
      setModal(null);
      setMessage("Product created");
      setTab("products");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function createSupplier(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/suppliers", {
        method: "POST",
        body: JSON.stringify({ name: supplierName }),
      });
      setSupplierName("");
      setModal(null);
      setMessage("Supplier added");
      setTab("suppliers");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Supplier failed");
    } finally {
      setBusy(false);
    }
  }

  async function createPO(e: React.FormEvent) {
    e.preventDefault();
    const session = getSession();
    setBusy(true);
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
      setModal(null);
      setMessage("PO created");
      setTab("pos");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "PO failed");
    } finally {
      setBusy(false);
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

  const headerAction =
    tab === "products"
      ? { label: "New product", onClick: () => setModal("product") }
      : tab === "suppliers"
        ? { label: "Add supplier", onClick: () => setModal("supplier") }
        : tab === "pos"
          ? { label: "New PO", onClick: () => setModal("po") }
          : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inventory"
        title="Stock & procurement"
        description="Catalog, on-hand quantities, suppliers, purchase orders, and transfers for the active branch."
        action={headerAction}
      />

      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      {tab === "stock" ? (
        <SurfaceCard>
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-subtle">
              <tr>
                <th className="px-4 py-3 font-semibold text-heading">SKU</th>
                <th className="px-4 py-3 font-semibold text-heading">Name</th>
                <th className="px-4 py-3 font-semibold text-heading">On hand</th>
                <th className="px-4 py-3 font-semibold text-heading">Avg cost</th>
              </tr>
            </thead>
            <tbody>
              {stock.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState title="No stock rows" body="Add products and receive a GRN." />
                  </td>
                </tr>
              ) : (
                stock.map((row) => (
                  <tr key={row.product_id} className="border-t border-border text-heading">
                    <td className="px-4 py-3">{row.sku}</td>
                    <td className="px-4 py-3">{row.name}</td>
                    <td className="px-4 py-3">{row.quantity_on_hand}</td>
                    <td className="px-4 py-3">{row.avg_cost}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </SurfaceCard>
      ) : null}

      {tab === "products" ? (
        <SurfaceCard>
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-subtle">
              <tr>
                <th className="px-4 py-3 font-semibold">SKU</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Price</th>
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
        </SurfaceCard>
      ) : null}

      {tab === "suppliers" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {suppliers.map((s) => (
            <SurfaceCard key={s.id} className="p-4">
              <p className="font-semibold text-heading">{s.name}</p>
            </SurfaceCard>
          ))}
          {suppliers.length === 0 ? (
            <SurfaceCard>
              <EmptyState title="No suppliers" body="Add a supplier to raise purchase orders." />
            </SurfaceCard>
          ) : null}
        </div>
      ) : null}

      {tab === "pos" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SurfaceCard className="p-5">
            <h2 className="font-semibold text-heading">Receive GRN</h2>
            <form onSubmit={receiveGRN} className="mt-4 space-y-3">
              <select
                className={fieldClass}
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
                className={fieldClass}
                placeholder="Qty received"
                value={grnForm.quantity_received}
                onChange={(e) =>
                  setGrnForm({ ...grnForm, quantity_received: e.target.value })
                }
                required
              />
              <Button type="submit">Receive</Button>
            </form>
          </SurfaceCard>

          <SurfaceCard>
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
                    <td className="px-4 py-3">
                      {p.supplier_name || p.supplier_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">{p.status}</td>
                    <td className="px-4 py-3">{p.items?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SurfaceCard>
        </div>
      ) : null}

      {tab === "transfers" ? (
        <div className="space-y-4">
          <SurfaceCard className="p-5">
            <form onSubmit={createTransfer} className="grid gap-3 md:grid-cols-4">
              <input
                className={fieldClass}
                placeholder="To branch ID"
                value={transferForm.to_branch_id}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, to_branch_id: e.target.value })
                }
                required
              />
              <select
                className={fieldClass}
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
                className={fieldClass}
                placeholder="Qty"
                value={transferForm.quantity}
                onChange={(e) =>
                  setTransferForm({ ...transferForm, quantity: e.target.value })
                }
              />
              <Button type="submit">Create transfer</Button>
            </form>
          </SurfaceCard>
          <div className="space-y-2">
            {transfers.map((t) => (
              <SurfaceCard
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
              >
                <span className="text-sm text-heading">
                  {t.status} · {t.items?.[0]?.quantity || "?"} units
                </span>
                {t.status === "pending" ? (
                  <Button size="sm" onClick={() => confirmTransfer(t.id)}>
                    Confirm
                  </Button>
                ) : null}
              </SurfaceCard>
            ))}
          </div>
        </div>
      ) : null}

      {tab === "adjust" ? (
        <SurfaceCard className="max-w-xl p-5">
          <form onSubmit={adjustStock} className="space-y-3">
            <select
              className={fieldClass}
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
              className={fieldClass}
              placeholder="Qty delta (e.g. -2 or 5)"
              value={adjustForm.quantity_delta}
              onChange={(e) =>
                setAdjustForm({ ...adjustForm, quantity_delta: e.target.value })
              }
              required
            />
            <select
              className={fieldClass}
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
            <Button type="submit">Apply adjustment</Button>
          </form>
        </SurfaceCard>
      ) : null}

      <Modal
        isOpen={modal === "product"}
        onClose={() => setModal(null)}
        title="New product"
        description="Add a SKU to the business catalog. Branch price is set on create when provided."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="product-modal-form" loading={busy}>
              Create product
            </Button>
          </div>
        }
      >
        <form id="product-modal-form" onSubmit={createProduct} className="space-y-4">
          <Field label="SKU">
            <input
              className={fieldClass}
              value={productForm.sku}
              onChange={(e) => setProductForm({ ...productForm, sku: e.target.value })}
              required
            />
          </Field>
          <Field label="Name">
            <input
              className={fieldClass}
              value={productForm.name}
              onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
              required
            />
          </Field>
          <Field label="Branch price">
            <input
              className={fieldClass}
              value={productForm.price}
              onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
              required
            />
          </Field>
        </form>
      </Modal>

      <Modal
        isOpen={modal === "supplier"}
        onClose={() => setModal(null)}
        title="Add supplier"
        description="Suppliers are used on purchase orders and AP bills."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" form="supplier-modal-form" loading={busy}>
              Add supplier
            </Button>
          </div>
        }
      >
        <form id="supplier-modal-form" onSubmit={createSupplier} className="space-y-4">
          <Field label="Supplier name">
            <input
              className={fieldClass}
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
              required
            />
          </Field>
        </form>
      </Modal>

      <Modal
        isOpen={modal === "po"}
        onClose={() => setModal(null)}
        title="New purchase order"
        description="Create a draft PO for the active branch."
      >
        <form id="po-modal-form" onSubmit={createPO} className="space-y-4">
          <Field label="Supplier">
            <select
              className={fieldClass}
              value={poForm.supplier_id}
              onChange={(e) => setPoForm({ ...poForm, supplier_id: e.target.value })}
              required
            >
              <option value="">Select…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Product">
            <select
              className={fieldClass}
              value={poForm.product_id}
              onChange={(e) => setPoForm({ ...poForm, product_id: e.target.value })}
              required
            >
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Quantity">
              <input
                className={fieldClass}
                value={poForm.quantity}
                onChange={(e) => setPoForm({ ...poForm, quantity: e.target.value })}
              />
            </Field>
            <Field label="Unit cost">
              <input
                className={fieldClass}
                value={poForm.unit_cost}
                onChange={(e) => setPoForm({ ...poForm, unit_cost: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button type="submit" onClick={createPO} loading={busy}>
              Create PO
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
