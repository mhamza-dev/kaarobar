"use client";

import Link from "@/components/ui/Link";
import {
  ArrowRight,
  Building2,
  GitBranch,
  Receipt,
  BookOpen,
  Users,
  WifiOff,
} from "lucide-react";

import { routes } from "@/lib/navigation";

export default function Hero() {
  return (
    <section className="relative overflow-hidden surface-mesh surface-noise">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-60" />

      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-0 h-162.5 w-162.5 -translate-x-1/2 rounded-full bg-brand/15 blur-[120px]" />
        <div className="absolute left-16 top-40 h-64 w-64 rounded-full bg-accent/15 blur-[120px]" />
        <div className="absolute bottom-0 right-16 h-80 w-80 rounded-full bg-info/15 blur-[140px]" />
      </div>

      <div className="relative mx-auto flex max-w-7xl flex-col items-center px-6 pb-24 pt-20 lg:flex-row lg:gap-20 lg:pt-32">
        <div className="flex-1 animate-rise">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft/80 px-4 py-2 text-sm font-medium text-brand backdrop-blur-sm">
            <Building2 className="h-4 w-4" />
            Multi-business · Multi-branch · Pakistan-ready
          </div>

          <h1 className="mt-8 text-5xl font-extrabold leading-tight tracking-tight text-heading lg:text-7xl">
            One owner.
            <span className="block text-gradient">Every business. Every branch.</span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-body">
            Kaarobar is a unified POS, Accounting, and Workforce platform for
            owners who run multiple businesses—each with multiple branches—
            with real double-entry books and offline-tolerant branch POS.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href={routes.signup}
              size="lg"
              endIcon={<ArrowRight size={18} />}
            >
              Start Free Trial
            </Link>

            <Link href={routes.login} variant="outline" size="lg">
              Sign In
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-2 gap-6 sm:grid-cols-3">
            <div>
              <h2 className="text-3xl font-bold text-heading">3</h2>
              <p className="text-sm text-body">Pillars: POS, Books, HR</p>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-heading">FBR</h2>
              <p className="text-sm text-body">Tier-1 POS ready</p>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-heading">24h</h2>
              <p className="text-sm text-body">Offline POS tolerance</p>
            </div>
          </div>
        </div>

        <div className="mt-16 flex-1 lg:mt-0">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                icon: Receipt,
                title: "Branch POS",
                body: "Fast checkout, tills, returns, and receipts—online or offline.",
              },
              {
                icon: BookOpen,
                title: "Real accounting",
                body: "Every sale and payroll posts a balanced journal automatically.",
              },
              {
                icon: Users,
                title: "HR & payroll",
                body: "Attendance, leave, and payroll that ties into the ledger.",
              },
              {
                icon: GitBranch,
                title: "Owner oversight",
                body: "Consolidated sales, cash, stock, and staff across businesses.",
              },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-border bg-card/90 p-5 shadow-sm backdrop-blur"
                >
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 font-semibold text-heading">{card.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-body">{card.body}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <WifiOff size={14} />
            Desktop POS keeps selling during connectivity outages, then syncs safely.
          </p>
        </div>
      </div>
    </section>
  );
}
