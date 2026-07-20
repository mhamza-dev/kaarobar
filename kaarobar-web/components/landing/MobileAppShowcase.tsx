"use client";

import Link from "@/components/ui/Link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CheckCircle2,
  Clock3,
  FileText,
  Package,
} from "lucide-react";

import { routes } from "@/lib/navigation";

const features = [
  {
    title: "Owner dashboard",
    description: "Consolidated sales, cash position, and stock alerts across businesses.",
    icon: BarChart3,
  },
  {
    title: "Approvals on the go",
    description: "Refund and payroll approval requests when you are not at the branch.",
    icon: Bell,
  },
  {
    title: "Employee self-service",
    description: "Clock in/out, leave requests, and payslip history—three primary actions.",
    icon: Clock3,
  },
  {
    title: "Low-stock alerts",
    description: "See reorder signals from every branch without opening the till.",
    icon: Package,
  },
];

const notifications = [
  "Branch Shahkot: refund above threshold awaiting approval",
  "Green Tea 250g low stock at Outlet 2",
  "Payroll run March pending owner approval",
  "Payslip available for Ahmad (ESS)",
];

export default function MobileAppShowcase() {
  return (
    <section id="mobile" className="bg-bg-secondary py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            Mobile app
          </span>
          <h2 className="mt-6 text-4xl font-bold tracking-tight text-heading md:text-5xl">
            Oversight for owners.
            <br />
            Self-service for staff.
          </h2>
          <p className="mt-6 text-lg leading-8 text-body">
            React Native for Android and iOS—owners and managers get dashboards
            and approvals; employees get attendance, leave, and payslips.
          </p>
        </div>

        <div className="mt-24 grid items-center gap-20 lg:grid-cols-2">
          <div className="space-y-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex gap-4">
                  <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                    <Icon size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-heading">{feature.title}</h3>
                    <p className="mt-1 text-body">{feature.description}</p>
                  </div>
                </div>
              );
            })}
            <Link href={routes.signup} size="lg" endIcon={<ArrowRight size={18} />}>
              Get started on web first
            </Link>
          </div>

          <div className="mx-auto w-full max-w-sm rounded-[2rem] border border-border bg-sidebar p-4 shadow-2xl">
            <div className="rounded-[1.5rem] bg-bg-primary p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                    Kaarobar
                  </p>
                  <p className="mt-1 text-lg font-bold text-heading">Owner alerts</p>
                </div>
                <FileText className="text-brand" size={22} />
              </div>
              <ul className="mt-6 space-y-3">
                {notifications.map((note) => (
                  <li
                    key={note}
                    className="flex gap-2 rounded-xl border border-border bg-card px-3 py-3 text-sm text-body"
                  >
                    <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={16} />
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
