"use client";

import Link from "@/components/ui/Link";
import { CheckCircle2, XCircle, Sparkles, ArrowRight } from "lucide-react";

import { routes } from "@/lib/navigation";

const comparisons = [
  {
    feature: "Point of Sale (POS)",
    kaarobar: true,
    others: true,
  },
  {
    feature: "Inventory Management",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Accounting",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Human Resources",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Payroll",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Attendance Management",
    kaarobar: true,
    others: false,
  },
  {
    feature: "CRM",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Multi Business",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Multi Branch",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Warehouse Management",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Role Based Permissions",
    kaarobar: true,
    others: false,
  },
  {
    feature: "AI Assistant",
    kaarobar: true,
    others: false,
  },
  {
    feature: "AI Reports",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Business Analytics",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Cloud Synchronization",
    kaarobar: true,
    others: true,
  },
  {
    feature: "Automatic Backups",
    kaarobar: true,
    others: false,
  },
  {
    feature: "Mobile Access",
    kaarobar: true,
    others: true,
  },
];

export default function ComparisonTable() {
  return (
    <section id="comparison" className="bg-bg-secondary py-28">
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}

        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-5 py-2 text-sm font-semibold text-brand">
            <Sparkles size={16} />
            Compare Platforms
          </div>

          <h2 className="mt-6 text-5xl font-bold tracking-tight text-heading">
            Stop Paying
            <br />
            For Multiple Software
          </h2>

          <p className="mt-6 text-lg leading-8 text-body">
            Traditional business management requires multiple disconnected
            applications. Kaarobar combines everything into one intelligent
            platform.
          </p>
        </div>

        {/* Table */}

        <div className="mt-20 overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
          {/* Header */}

          <div className="grid grid-cols-3 border-b border-border bg-brand px-8 py-6 text-white">
            <div className="text-lg font-semibold">Features</div>

            <div className="text-center">
              <h3 className="text-xl font-bold">Kaarobar</h3>

              <p className="mt-1 text-sm text-white/80">Business OS</p>
            </div>

            <div className="text-center">
              <h3 className="text-xl font-bold">Traditional Software</h3>

              <p className="mt-1 text-sm text-white/80">Multiple Apps</p>
            </div>
          </div>

          {/* Rows */}

          {comparisons.map((item, index) => (
            <div
              key={item.feature}
              className={`
                grid
                grid-cols-3
                items-center
                px-8
                py-5

                ${index % 2 === 0 ? "bg-bg-primary" : "bg-card"}

                hover:bg-brand-soft/40
                transition
              `}
            >
              <div className="font-medium text-heading">{item.feature}</div>

              <div className="flex justify-center">
                {item.kaarobar ? (
                  <CheckCircle2 className="text-success" size={24} />
                ) : (
                  <XCircle className="text-danger" size={24} />
                )}
              </div>

              <div className="flex justify-center">
                {item.others ? (
                  <CheckCircle2 className="text-success" size={24} />
                ) : (
                  <XCircle className="text-danger" size={24} />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}

        <div className="mt-16 rounded-3xl bg-brand p-10 text-center text-white shadow-xl">
          <h3 className="text-4xl font-bold">
            Replace 8+ Different Applications
          </h3>

          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-white/90">
            Instead of paying for POS, Inventory, Accounting, HR, Payroll, CRM
            and Reporting separately, manage everything with one secure
            platform.
          </p>

          <div className="mt-8">
            <Link
              href={routes.signup}
              size="lg"
              variant="inverted"
              endIcon={<ArrowRight size={18} />}
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
