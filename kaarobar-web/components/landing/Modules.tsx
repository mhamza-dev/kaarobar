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
    body: "Cart, split payments, discounts with approval limits, returns, till open/close, ESC/POS receipts, and idempotent offline sync.",
  },
  {
    id: "inventory",
    icon: Package,
    title: "Inventory & Procurement",
    body: "Business catalog with branch prices, per-branch stock, transfers, purchase orders, GRNs, and audited adjustments.",
  },
  {
    id: "accounting",
    icon: BookOpenCheck,
    title: "Accounting & Finance",
    body: "Pakistan COA template, immutable posted journals, GL, trial balance, P&L, balance sheet, AR/AP, and tax configuration.",
  },
  {
    id: "hr",
    icon: UserRoundCog,
    title: "HR & Payroll",
    body: "Employee records, POS/mobile attendance, leave workflows, statutory deductions, and payroll that posts to the ledger.",
  },
  {
    id: "reporting",
    icon: LineChart,
    title: "Reporting & Oversight",
    body: "Owner-level consolidated dashboards plus branch daily sales and shift reconciliation reports.",
  },
  {
    id: "compliance",
    icon: ShieldCheck,
    title: "Pakistan compliance",
    body: "Configurable tax engine with Pakistan defaults and FBR Tier-1 real-time reporting hooks without blocking checkout.",
  },
];

export default function Modules() {
  return (
    <section id="modules" className="bg-bg-primary py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            Product pillars
          </span>
          <h2 className="mt-6 text-4xl font-bold text-heading md:text-5xl">
            POS, books, and workforce—connected.
          </h2>
          <p className="mt-5 text-lg leading-8 text-body">
            Release 1.0 focuses on Must-have workflows from the Kaarobar SRS:
            operational speed at the till, audit-ready accounting underneath,
            and HR that does not live in a separate spreadsheet.
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
