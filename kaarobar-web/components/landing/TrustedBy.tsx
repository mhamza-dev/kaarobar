"use client";

import {
  Store,
  ShoppingCart,
  Warehouse,
  UtensilsCrossed,
  Pill,
  Factory,
} from "lucide-react";

const industries = [
  {
    title: "Retail & trading",
    icon: Store,
    description: "Multi-branch shops with shared catalogs and branch pricing.",
  },
  {
    title: "Wholesale",
    icon: Warehouse,
    description: "Purchase orders, GRNs, and supplier AP tracking.",
  },
  {
    title: "Restaurants & cafes",
    icon: UtensilsCrossed,
    description: "Fast tills with tax-ready receipts and shift reconciliation.",
  },
  {
    title: "Pharmacy",
    icon: Pill,
    description: "Branch stock control with low-stock alerts.",
  },
  {
    title: "Supermarket",
    icon: ShoppingCart,
    description: "High-volume barcode checkout and cash drawer support.",
  },
  {
    title: "Light manufacturing",
    icon: Factory,
    description: "Stock in/out and transfers between locations (v1 scope).",
  },
];

export default function TrustedBy() {
  return (
    <section id="solutions" className="border-y border-border bg-bg-secondary py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand">
            Built for multi-location owners
          </p>

          <h2 className="mt-4 text-4xl font-bold text-heading">
            Designed opposite to single-shop POS tools.
          </h2>

          <p className="mt-5 text-lg text-body">
            Owner → Business → Branch is the foundation—not a bolt-on. Run a
            retail shop, a services company, and a small unit under one login
            with branch-level autonomy and central oversight.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((industry) => {
            const Icon = industry.icon;

            return (
              <div
                key={industry.title}
                className="group rounded-2xl border border-border bg-card p-8 transition-all duration-300 hover:-translate-y-2 hover:border-brand/30 hover:shadow-xl"
              >
                <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand transition-all duration-300 group-hover:scale-110 group-hover:bg-brand group-hover:text-white">
                  <Icon size={28} />
                </div>

                <h3 className="mt-6 text-xl font-semibold text-heading">
                  {industry.title}
                </h3>

                <p className="mt-2 leading-7 text-body">{industry.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
