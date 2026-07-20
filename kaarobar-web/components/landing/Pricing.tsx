"use client";

import Link from "@/components/ui/Link";
import { Check, ArrowRight } from "lucide-react";

import { routes } from "@/lib/navigation";

const plans = [
  {
    name: "Trial",
    price: "Free",
    period: " · 14 days",
    description: "Try Kaarobar with a sample business, branches, and chart of accounts.",
    featured: false,
    features: [
      "1 business · 2 branches",
      "POS + inventory",
      "Pakistan chart of accounts included",
      "Owner dashboard",
      "Email support",
    ],
  },
  {
    name: "Starter",
    price: "Rs 4,999",
    period: "/month",
    description: "A solid fit when one business is growing across a few shops.",
    featured: false,
    features: [
      "Up to 3 businesses",
      "Up to 10 branches",
      "POS, inventory, accounting",
      "Attendance & leave",
      "PDF and Excel exports",
    ],
  },
  {
    name: "Growth",
    price: "Rs 12,999",
    period: "/month",
    description: "For owners juggling several businesses who need payroll and FBR.",
    featured: true,
    features: [
      "Up to 10 businesses",
      "Up to 50 branches",
      "Payroll that posts to the ledger",
      "FBR Tier-1 reporting",
      "Approvals and audit history",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Higher limits, hands-on onboarding, and help with compliance setup.",
    featured: false,
    features: [
      "Custom business and branch limits",
      "A named person to help you",
      "Security review support",
      "Custom tax templates",
      "SLA options",
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-bg-primary py-28">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-md bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            Pricing
          </span>
          <h2 className="mt-6 text-4xl font-bold text-heading md:text-5xl">
            Plans that grow with how you actually expand.
          </h2>
          <p className="mt-5 text-lg text-body">
            You pay Kaarobar for the software (via LemonSqueezy). That’s separate
            from what your customers pay you at the till.
          </p>
        </div>

        <div className="mt-16 grid items-stretch gap-6 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex h-full flex-col rounded-md border p-8 ${
                plan.featured
                  ? "border-brand bg-brand text-white shadow-xl"
                  : "border-border bg-card text-heading"
              }`}
            >
              <h3
                className={`text-xl font-semibold ${
                  plan.featured ? "text-white" : "text-heading"
                }`}
              >
                {plan.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1">
                <span
                  className={`text-3xl font-bold ${
                    plan.featured ? "text-white" : "text-heading"
                  }`}
                >
                  {plan.price}
                </span>
                <span className={plan.featured ? "text-white/80" : "text-muted"}>
                  {plan.period}
                </span>
              </div>
              <p
                className={`mt-3 text-sm leading-6 ${
                  plan.featured ? "text-white/90" : "text-body"
                }`}
              >
                {plan.description}
              </p>
              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    className={`flex gap-2 text-sm ${
                      plan.featured ? "text-white" : "text-body"
                    }`}
                  >
                    <Check
                      size={18}
                      className={
                        plan.featured
                          ? "shrink-0 text-white"
                          : "shrink-0 text-success"
                      }
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href={routes.signup}
                  variant={plan.featured ? "inverted" : "primary"}
                  fullWidth
                  className="justify-center"
                  endIcon={<ArrowRight size={16} />}
                >
                  Get started
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
