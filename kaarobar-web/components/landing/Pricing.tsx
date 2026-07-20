"use client";

import Link from "@/components/ui/Link";
import { Check, ArrowRight } from "lucide-react";

import { routes } from "@/lib/navigation";

const plans = [
  {
    name: "Trial",
    price: "Free",
    period: " · 14 days",
    description: "Evaluate the owner → business → branch model with seeded COA.",
    featured: false,
    features: [
      "1 business · 2 branches",
      "POS + inventory core",
      "Default Pakistan chart of accounts",
      "Owner dashboard",
      "Email support",
    ],
  },
  {
    name: "Starter",
    price: "Rs 4,999",
    period: "/month",
    description: "For a single growing business with a few locations.",
    featured: false,
    features: [
      "Up to 3 businesses",
      "Up to 10 branches",
      "POS, inventory, accounting",
      "HR attendance & leave",
      "PDF/Excel report exports",
    ],
  },
  {
    name: "Growth",
    price: "Rs 12,999",
    period: "/month",
    description: "For multi-business owners who need payroll and FBR hooks.",
    featured: true,
    features: [
      "Up to 10 businesses",
      "Up to 50 branches",
      "Full payroll → ledger posting",
      "FBR Tier-1 adapter",
      "Approval workflows & audit log",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Higher limits, dedicated onboarding, and compliance review.",
    featured: false,
    features: [
      "Custom business/branch limits",
      "Dedicated success contact",
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
          <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            Subscription billing
          </span>
          <h2 className="mt-6 text-4xl font-bold text-heading md:text-5xl">
            Plans that match how owners actually scale.
          </h2>
          <p className="mt-5 text-lg text-body">
            Platform billing is for your Kaarobar subscription (LemonSqueezy)—
            separate from card payments your customers make at the till.
          </p>
        </div>

        <div className="mt-16 grid gap-6 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-3xl border p-8 ${
                plan.featured
                  ? "border-brand bg-brand text-white shadow-xl"
                  : "border-border bg-card"
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
                <span className="text-3xl font-bold">{plan.price}</span>
                <span className={plan.featured ? "text-white/80" : "text-muted"}>
                  {plan.period}
                </span>
              </div>
              <p
                className={`mt-3 text-sm leading-6 ${
                  plan.featured ? "text-white/85" : "text-body"
                }`}
              >
                {plan.description}
              </p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2 text-sm">
                    <Check
                      size={18}
                      className={plan.featured ? "text-white" : "text-success"}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={routes.signup}
                variant={plan.featured ? "secondary" : "primary"}
                className="mt-8 w-full justify-center"
                endIcon={<ArrowRight size={16} />}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
