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
    title: "Retail",
    icon: Store,
    description: "Modern retail stores",
  },
  {
    title: "Wholesale",
    icon: Warehouse,
    description: "Bulk inventory management",
  },
  {
    title: "Restaurants",
    icon: UtensilsCrossed,
    description: "Fast POS & billing",
  },
  {
    title: "Pharmacy",
    icon: Pill,
    description: "Medicine inventory",
  },
  {
    title: "Super Market",
    icon: ShoppingCart,
    description: "High-volume checkout",
  },
  {
    title: "Manufacturing",
    icon: Factory,
    description: "Production businesses",
  },
];

export default function TrustedBy() {
  return (
    <section id="solutions" className="border-y border-border bg-bg-secondary py-20">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand">
            Trusted Across Industries
          </p>

          <h2 className="mt-4 text-4xl font-bold text-heading">
            Built for every growing business.
          </h2>

          <p className="mt-5 text-lg text-body">
            Whether you&apos;re running a retail shop, restaurant, warehouse,
            pharmacy or manufacturing business, Kaarobar provides everything you
            need to manage your operations from one platform.
          </p>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {industries.map((industry) => {
            const Icon = industry.icon;

            return (
              <div
                key={industry.title}
                className="
                  group
                  rounded-2xl
                  border
                  border-border
                  bg-card
                  p-8
                  transition-all
                  duration-300
                  hover:-translate-y-2
                  hover:border-brand/30
                  hover:shadow-xl
                "
              >
                <div
                  className="
                    inline-flex
                    h-14
                    w-14
                    items-center
                    justify-center
                    rounded-2xl
                    bg-brand-soft
                    text-brand
                    transition-all
                    duration-300
                    group-hover:scale-110
                    group-hover:bg-brand
                    group-hover:text-white
                  "
                >
                  <Icon size={28} />
                </div>

                <h3 className="mt-6 text-xl font-semibold text-heading">
                  {industry.title}
                </h3>

                <p className="mt-2 leading-7 text-body">
                  {industry.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="mt-20 rounded-3xl border border-brand/10 bg-brand-soft p-10 text-center">
          <h3 className="text-2xl font-bold text-heading">
            One Platform. Unlimited Possibilities.
          </h3>

          <p className="mx-auto mt-4 max-w-3xl text-body">
            Kaarobar replaces multiple disconnected tools by combining POS,
            Inventory, Accounting, HR, Payroll, Reporting and AI into a single,
            unified business operating system.
          </p>
        </div>
      </div>
    </section>
  );
}
