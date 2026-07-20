"use client";

import Link from "@/components/ui/Link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BrainCircuit,
  CheckCircle2,
  CreditCard,
  Package,
  Store,
} from "lucide-react";

import { routes } from "@/lib/navigation";

const features = [
  {
    title: "Real-Time Sales",
    description: "Monitor today's revenue, orders and transactions instantly.",
    icon: BarChart3,
  },
  {
    title: "Inventory Alerts",
    description: "Receive low-stock notifications before products run out.",
    icon: Package,
  },
  {
    title: "AI Business Assistant",
    description: "Ask business questions using natural language.",
    icon: BrainCircuit,
  },
  {
    title: "Payment Tracking",
    description: "Track invoices, expenses and customer payments.",
    icon: CreditCard,
  },
];

const notifications = [
  "Today's sales increased by 18%",
  "Milk stock is running low",
  "Payroll generated successfully",
  "12 new invoices created today",
];

export default function MobileAppShowcase() {
  return (
    <section id="mobile" className="bg-bg-secondary py-28">
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}

        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            Mobile Experience
          </span>

          <h2 className="mt-6 text-5xl font-bold tracking-tight text-heading">
            Your Business
            <br />
            Always in Your Pocket
          </h2>

          <p className="mt-6 text-lg leading-8 text-body">
            Whether you&apos;re in your office, warehouse, or traveling, Kaarobar
            gives you complete visibility and control over your business from
            anywhere.
          </p>
        </div>

        {/* Content */}

        <div className="mt-24 grid items-center gap-20 lg:grid-cols-2">
          {/* Left */}

          <div>
            <div className="space-y-8">
              {features.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="
                      group
                      flex
                      gap-5
                      rounded-3xl
                      border
                      border-border
                      bg-card
                      p-6
                      transition-all
                      duration-300
                      hover:-translate-y-1
                      hover:border-brand/30
                      hover:shadow-xl
                    "
                  >
                    <div
                      className="
                        flex
                        h-14
                        w-14
                        shrink-0
                        items-center
                        justify-center
                        rounded-2xl
                        bg-brand-soft
                        text-brand
                        transition
                        group-hover:bg-brand
                        group-hover:text-white
                      "
                    >
                      <Icon size={26} />
                    </div>

                    <div>
                      <h3 className="text-xl font-semibold text-heading">
                        {feature.title}
                      </h3>

                      <p className="mt-2 leading-7 text-body">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href={routes.signup}
                size="lg"
                endIcon={<ArrowRight size={18} />}
              >
                Download App
              </Link>

              <Link href={routes.contact} size="lg" variant="secondary">
                Learn More
              </Link>
            </div>
          </div>

          {/* Right */}

          <div className="relative flex justify-center">
            {/* Glow */}

            <div className="absolute h-96 w-96 rounded-full bg-brand/10 blur-3xl" />

            {/* Phone */}

            <div className="relative w-85 rounded-[42px] border-8 border-slate-900 bg-slate-900 p-3 shadow-2xl">
              {/* Dynamic Island */}

              <div className="mx-auto mb-3 h-7 w-36 rounded-full bg-black" />

              {/* Screen */}

              <div className="overflow-hidden rounded-4xl bg-bg-primary">
                {/* Header */}

                <div className="bg-brand p-6 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/80">Welcome Back</p>

                      <h3 className="mt-1 text-2xl font-bold">Hamza 👋</h3>
                    </div>

                    <Store size={30} />
                  </div>

                  <div className="mt-8 rounded-2xl bg-white/15 p-5 backdrop-blur">
                    <p className="text-sm text-white/80">Today&apos;s Revenue</p>

                    <h2 className="mt-2 text-4xl font-bold">$18,420</h2>

                    <p className="mt-1 text-green-300">↑ 18.4% this week</p>
                  </div>
                </div>

                {/* Quick Actions */}

                <div className="grid grid-cols-2 gap-4 p-6">
                  <div className="rounded-2xl bg-card p-4 shadow">
                    <Package className="text-brand" />
                    <p className="mt-3 font-semibold text-heading">Inventory</p>
                  </div>

                  <div className="rounded-2xl bg-card p-4 shadow">
                    <CreditCard className="text-brand" />
                    <p className="mt-3 font-semibold text-heading">Payments</p>
                  </div>

                  <div className="rounded-2xl bg-card p-4 shadow">
                    <BrainCircuit className="text-brand" />
                    <p className="mt-3 font-semibold text-heading">AI</p>
                  </div>

                  <div className="rounded-2xl bg-card p-4 shadow">
                    <BarChart3 className="text-brand" />
                    <p className="mt-3 font-semibold text-heading">Reports</p>
                  </div>
                </div>
              </div>

              {/* Floating Notification */}

              <div className="absolute -left-36 top-20 hidden w-72 rounded-2xl border border-border bg-card p-4 shadow-2xl xl:block">
                <div className="flex items-center gap-3">
                  <Bell className="text-brand" size={20} />

                  <div>
                    <p className="font-semibold text-heading">
                      Smart Notifications
                    </p>

                    <p className="text-sm text-body">
                      Stay informed in real time.
                    </p>
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {notifications.map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-1 text-success" size={16} />

                      <p className="text-sm text-body">{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI Bubble */}

              <div className="absolute -right-28 bottom-24 hidden w-64 rounded-2xl border border-border bg-card p-5 shadow-2xl xl:block">
                <div className="flex items-center gap-3">
                  <BrainCircuit className="text-brand" size={22} />

                  <p className="font-semibold text-heading">AI Insight</p>
                </div>

                <p className="mt-4 text-sm leading-7 text-body">
                  Sales increased by <strong>18%</strong> this week. Consider
                  restocking your top-selling products.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
