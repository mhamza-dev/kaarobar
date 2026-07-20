"use client";

import Link from "@/components/ui/Link";
import {
  ArrowRight,
  Sparkles,
  BarChart3,
  Boxes,
  Users,
  Wallet,
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
            <Sparkles className="h-4 w-4" />
            AI Powered Business Operating System
          </div>

          <h1 className="mt-8 text-5xl font-extrabold leading-tight tracking-tight text-heading lg:text-7xl">
            Run Your Entire Business
            <span className="block text-gradient">From One Platform.</span>
          </h1>

          <p className="mt-8 max-w-xl text-lg leading-8 text-body">
            Kaarobar combines POS, Inventory, Accounting, HR, Payroll, Reporting
            and AI into one beautifully designed cloud platform.
          </p>

          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href={routes.signup}
              size="lg"
              endIcon={<ArrowRight size={18} />}
            >
              Start Free Trial
            </Link>

            <Link href={routes.contact} variant="outline" size="lg">
              Book Demo
            </Link>
          </div>

          {/* Stats */}

          <div className="mt-14 grid grid-cols-3 gap-8">
            <div>
              <h2 className="text-3xl font-bold text-heading">50+</h2>

              <p className="text-sm text-body">Business Modules</p>
            </div>

            <div>
              <h2 className="text-3xl font-bold text-heading">99.9%</h2>

              <p className="text-sm text-body">Uptime</p>
            </div>

            <div>
              <h2 className="text-3xl font-bold text-heading">24/7</h2>

              <p className="text-sm text-body">Cloud Access</p>
            </div>
          </div>
        </div>

        {/* Right */}

        <div className="mt-16 flex-1 animate-float lg:mt-0">
          <div className="rounded-3xl border border-border bg-bg-secondary/95 p-8 shadow-xl backdrop-blur-sm">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-heading">Business Overview</h3>

                <p className="text-sm text-body">Today • Live Dashboard</p>
              </div>

              <div className="rounded-full bg-success px-3 py-1 text-xs font-semibold text-white">
                Live
              </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
              <DashboardCard
                icon={<Wallet className="h-6 w-6" />}
                title="Revenue"
                value="$24,840"
              />

              <DashboardCard
                icon={<Boxes className="h-6 w-6" />}
                title="Inventory"
                value="1,428"
              />

              <DashboardCard
                icon={<Users className="h-6 w-6" />}
                title="Employees"
                value="96"
              />

              <DashboardCard
                icon={<BarChart3 className="h-6 w-6" />}
                title="Profit"
                value="+18%"
              />
            </div>

            <div className="mt-8 rounded-2xl bg-brand-gradient p-6 text-white shadow-brand">
              <p className="text-sm opacity-90">AI Assistant</p>

              <h4 className="mt-2 text-lg font-semibold">
                Revenue increased by 18% this month.
              </h4>

              <p className="mt-2 text-sm opacity-90">
                Inventory is running low for 12 products.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-bg-primary p-5 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="mb-4 inline-flex rounded-xl bg-brand-soft p-3 text-brand">
        {icon}
      </div>

      <p className="text-sm text-body">{title}</p>

      <h3 className="mt-1 text-2xl font-bold text-heading">{value}</h3>
    </div>
  );
}
