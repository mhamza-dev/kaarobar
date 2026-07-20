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
    description: "Several shops, one catalog, prices that can differ by branch.",
  },
  {
    title: "Wholesale",
    icon: Warehouse,
    description: "Purchase orders, goods receipts, and supplier balances.",
  },
  {
    title: "Restaurants & cafes",
    icon: UtensilsCrossed,
    description: "Fast tills, tax on receipts, and clean end-of-shift counts.",
  },
  {
    title: "Pharmacy",
    icon: Pill,
    description: "Branch stock you can trust, with low-stock alerts.",
  },
  {
    title: "Supermarket",
    icon: ShoppingCart,
    description: "Barcode checkout at volume, with cash drawer support.",
  },
  {
    title: "Light manufacturing",
    icon: Factory,
    description: "Move stock in and out, and transfer between locations.",
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
            Not another single-shop POS.
          </h2>

          <p className="mt-5 text-lg text-body">
            Owner, business, and branch sit at the center—not bolted on later.
            Run a retail shop, a services company, and a small unit under one
            login. Each branch works on its own; you still see the whole picture.
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
