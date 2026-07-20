"use client";

import Link from "@/components/ui/Link";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";

import { routes } from "@/lib/navigation";

const comparisons = [
  { feature: "Owner → Business → Branch hierarchy", kaarobar: true, others: false },
  { feature: "Multi-business under one owner", kaarobar: true, others: false },
  { feature: "Multi-branch operations", kaarobar: true, others: "Limited" },
  { feature: "Offline-capable desktop POS", kaarobar: true, others: "Limited" },
  { feature: "Idempotent offline sync", kaarobar: true, others: false },
  { feature: "Double-entry auto-posting from POS", kaarobar: true, others: false },
  { feature: "Immutable journals + reversals", kaarobar: true, others: false },
  { feature: "Pakistan tax template + FBR Tier-1 hooks", kaarobar: true, others: false },
  { feature: "Inventory, PO & GRN", kaarobar: true, others: "Partial" },
  { feature: "HR, attendance & payroll → ledger", kaarobar: true, others: false },
  { feature: "Role-based access (cashier → owner)", kaarobar: true, others: true },
  { feature: "Owner consolidated dashboard", kaarobar: true, others: false },
  { feature: "Web + mobile + desktop clients", kaarobar: true, others: "Partial" },
];

export default function ComparisonTable() {
  return (
    <section id="comparison" className="bg-bg-secondary py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            Why Kaarobar
          </span>
          <h2 className="mt-6 text-4xl font-bold text-heading md:text-5xl">
            Built for owners who are never in one place.
          </h2>
          <p className="mt-5 text-lg text-body">
            Most POS products are single-shop first. Kaarobar starts from
            multi-business, multi-branch ownership and proper books.
          </p>
        </div>

        <div className="mt-14 overflow-hidden rounded-3xl border border-border bg-card">
          <div className="grid grid-cols-[1.5fr_1fr_1fr] border-b border-border bg-bg-tertiary px-6 py-4 text-sm font-semibold text-heading">
            <div>Capability</div>
            <div className="text-center text-brand">Kaarobar</div>
            <div className="text-center text-muted">Typical POS</div>
          </div>

          {comparisons.map((row) => (
            <div
              key={row.feature}
              className="grid grid-cols-[1.5fr_1fr_1fr] items-center border-b border-border px-6 py-4 last:border-b-0"
            >
              <div className="text-sm font-medium text-heading">{row.feature}</div>
              <div className="flex justify-center">
                {row.kaarobar === true ? (
                  <CheckCircle2 className="text-success" size={22} />
                ) : (
                  <span className="text-sm text-body">{String(row.kaarobar)}</span>
                )}
              </div>
              <div className="flex justify-center">
                {row.others === true ? (
                  <CheckCircle2 className="text-muted" size={22} />
                ) : row.others === false ? (
                  <XCircle className="text-danger/70" size={22} />
                ) : (
                  <span className="text-sm text-muted">{String(row.others)}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link href={routes.signup} size="lg" endIcon={<ArrowRight size={18} />}>
            Create your owner account
          </Link>
        </div>
      </div>
    </section>
  );
}
