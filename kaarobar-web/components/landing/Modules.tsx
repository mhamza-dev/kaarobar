"use client";

import {
  Receipt,
  Package,
  BookOpenCheck,
  UserRoundCog,
  LineChart,
  ShieldCheck,
} from "lucide-react";

const modules = [
  {
    id: "pos",
    icon: Receipt,
    title: "POS & Sales",
    body: "Quick checkout, split payments, discounts with manager limits, returns, open and close till, and printed receipts. The desktop till works offline and syncs without creating double sales.",
  },
  {
    id: "inventory",
    icon: Package,
    title: "Inventory & Procurement",
    body: "One catalog for the business, prices and stock per branch, transfers between shops, purchase orders, goods receipts, and stock adjustments you can audit later.",
  },
  {
    id: "accounting",
    icon: BookOpenCheck,
    title: "Accounting & Finance",
    body: "Start with a Pakistan chart of accounts, keep posted journals locked, and pull GL, trial balance, P&L, and balance sheet. Tax settings live with the business—not in a spreadsheet.",
  },
  {
    id: "hr",
    icon: UserRoundCog,
    title: "HR & Payroll",
    body: "Employee records, clock-in from the till or phone, leave requests, statutory deductions, and payroll that posts into the same books as your sales.",
  },
  {
    id: "reporting",
    icon: LineChart,
    title: "Reporting & Oversight",
    body: "An owner view across every business, plus daily sales and shift reports for each branch so you know what happened when you weren’t there.",
  },
  {
    id: "compliance",
    icon: ShieldCheck,
    title: "Pakistan compliance",
    body: "Tax rates that match how you sell here, and FBR Tier-1 reporting that runs in the background so cashiers aren’t stuck waiting on a government API.",
  },
];

export default function Modules() {
  return (
    <section id="modules" className="bg-bg-primary py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            What you get
          </span>
          <h2 className="mt-6 text-4xl font-bold text-heading md:text-5xl">
            POS, books, and staff—tied together.
          </h2>
          <p className="mt-5 text-lg leading-8 text-body">
            Fast at the counter, honest in the ledger, and HR that doesn’t live
            in a separate file. That’s the core of Kaarobar.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <article
                key={mod.id}
                id={mod.id}
                className="rounded-2xl border border-border bg-card p-8"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                  <Icon size={24} />
                </div>
                <h3 className="mt-5 text-xl font-semibold text-heading">{mod.title}</h3>
                <p className="mt-3 leading-7 text-body">{mod.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
