"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api/client";

type Product = { id: string; sku: string; name: string; price?: string };

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ sku: "", name: "", price: "" });

  async function load() {
    try {
      const res = await api<{ data: Product[] }>("/products");
      setProducts(res.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/products", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm({ sku: "", name: "", price: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inventory</h1>
        <p className="text-[#4A5A52]">Your product list and stock at each branch.</p>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <form
        onSubmit={createProduct}
        className="grid gap-3 rounded-xl border border-[#D9D3C7] bg-white p-4 md:grid-cols-4"
      >
        <input
          className="rounded-lg border border-[#D9D3C7] px-3 py-2"
          placeholder="SKU"
          value={form.sku}
          onChange={(e) => setForm({ ...form, sku: e.target.value })}
          required
        />
        <input
          className="rounded-lg border border-[#D9D3C7] px-3 py-2"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="rounded-lg border border-[#D9D3C7] px-3 py-2"
          placeholder="Price"
          value={form.price}
          onChange={(e) => setForm({ ...form, price: e.target.value })}
          required
        />
        <button
          type="submit"
          className="rounded-lg bg-[#1C2B24] px-4 py-2 font-semibold text-white"
        >
          Add product
        </button>
      </form>
      <div className="overflow-hidden rounded-xl border border-[#D9D3C7] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FAF8F4]">
            <tr>
              <th className="px-4 py-3">SKU</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Price</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-[#D9D3C7]">
                <td className="px-4 py-3">{p.sku}</td>
                <td className="px-4 py-3">{p.name}</td>
                <td className="px-4 py-3">{p.price ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
