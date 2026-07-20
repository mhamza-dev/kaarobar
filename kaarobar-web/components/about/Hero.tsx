"use client";

import Link from "@/components/ui/Link";
import { ArrowRight, Sparkles } from "lucide-react";

import { routes } from "@/lib/navigation";

export default function AboutHero() {
  return (
    <section className="relative overflow-hidden bg-bg-primary py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2563eb10,transparent_65%)]" />

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
          <Sparkles size={16} />
          About Kaarobar
        </div>

        <h1 className="mt-8 text-5xl font-bold leading-tight text-heading md:text-7xl">
          Reduce owner hustle.
          <br />
          Keep the books honest.
        </h1>

        <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-body">
          Kaarobar exists for Pakistan-first multi-business owners who cannot be
          at every branch. We combine offline-tolerant POS, double-entry
          accounting, and workforce payroll so financial statements stay
          audit-ready without re-keying into a separate ledger.
        </p>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 text-left md:grid-cols-3">
          {[
            {
              title: "G1 — Trustworthy overview",
              body: "One consolidated view of sales, cash, stock, and staff across every business you own.",
            },
            {
              title: "G2 — Real accounting",
              body: "Every POS, purchase, and payroll run posts balanced journals automatically.",
            },
            {
              title: "G3 — Branch autonomy",
              body: "Cashiers operate offline; owners retain approval on exceptions and payroll.",
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-border bg-card p-5">
              <h3 className="font-semibold text-heading">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-body">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10">
          <Link href={routes.signup} size="lg" endIcon={<ArrowRight size={18} />}>
            Start Free Trial
          </Link>
        </div>
      </div>
    </section>
  );
}
