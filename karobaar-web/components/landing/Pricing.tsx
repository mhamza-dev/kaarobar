"use client";

import Link from "@/components/ui/Link";
import { Check, ArrowRight, Sparkles } from "lucide-react";

import { routes } from "@/lib/navigation";

const plans = [
  {
    name: "Starter",
    price: "$19",
    period: "/month",
    description: "Perfect for small businesses getting started.",
    featured: false,
    features: [
      "1 Business",
      "1 Branch",
      "POS System",
      "Inventory",
      "Basic Reports",
      "Customer Management",
      "Email Support",
    ],
  },
  {
    name: "Growth",
    price: "$49",
    period: "/month",
    description: "Ideal for growing businesses.",
    featured: true,
    features: [
      "Unlimited Products",
      "Unlimited Customers",
      "Multiple Branches",
      "Accounting",
      "HR Management",
      "Payroll",
      "Advanced Reports",
      "AI Assistant",
      "Priority Support",
    ],
  },
  {
    name: "Business",
    price: "$99",
    period: "/month",
    description: "For businesses managing multiple operations.",
    featured: false,
    features: [
      "Unlimited Businesses",
      "Unlimited Warehouses",
      "Advanced Accounting",
      "CRM",
      "Assets",
      "Projects",
      "Role Permissions",
      "Analytics Dashboard",
      "API Access",
    ],
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "Tailored solutions for enterprise organizations.",
    featured: false,
    features: [
      "Everything in Business",
      "Dedicated Infrastructure",
      "SSO",
      "Advanced Security",
      "Custom Integrations",
      "White Label",
      "Dedicated Success Manager",
      "24/7 Support",
      "Custom SLA",
    ],
  },
];

export default function Pricing() {
  return (
    <section id="pricing" className="bg-bg-secondary py-28">
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}

        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            <Sparkles size={16} />
            Simple Pricing
          </div>

          <h2 className="mt-6 text-5xl font-bold text-heading">
            Choose the Perfect Plan
          </h2>

          <p className="mt-6 text-lg leading-8 text-body">
            Start small and scale confidently. Upgrade anytime as your business
            grows.
          </p>
        </div>

        {/* Pricing Grid */}

        <div className="mt-20 grid gap-8 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`
                relative
                flex
                flex-col
                rounded-3xl
                border
                p-8
                transition-all
                duration-300
                hover:-translate-y-2
                hover:shadow-2xl

                ${
                  plan.featured
                    ? "border-brand bg-brand text-white shadow-2xl scale-105"
                    : "border-border bg-card"
                }
              `}
            >
              {plan.featured && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-heading px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white">
                  Most Popular
                </div>
              )}

              <h3
                className={`text-2xl font-bold ${
                  plan.featured ? "text-white" : "text-heading"
                }`}
              >
                {plan.name}
              </h3>

              <p
                className={`mt-3 ${
                  plan.featured ? "text-white/80" : "text-body"
                }`}
              >
                {plan.description}
              </p>

              <div className="mt-8 flex items-end">
                <span className="text-5xl font-bold">{plan.price}</span>

                <span
                  className={`ml-2 mb-2 ${
                    plan.featured ? "text-white/70" : "text-muted"
                  }`}
                >
                  {plan.period}
                </span>
              </div>

              <ul className="mt-10 space-y-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <Check
                      size={18}
                      className={plan.featured ? "text-white" : "text-success"}
                    />

                    <span
                      className={plan.featured ? "text-white/90" : "text-body"}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-auto pt-10">
                <Link
                  href={
                    plan.name === "Enterprise" ? routes.contact : routes.signup
                  }
                  fullWidth
                  size="lg"
                  variant={plan.featured ? "secondary" : "primary"}
                  endIcon={<ArrowRight size={18} />}
                >
                  {plan.name === "Enterprise" ? "Contact Sales" : "Get Started"}
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Note */}

        <div className="mt-16 text-center">
          <p className="text-body">
            ✓ No setup fees &nbsp; • &nbsp; ✓ Cancel anytime &nbsp; • &nbsp; ✓
            Free updates &nbsp; • &nbsp; ✓ Secure cloud hosting
          </p>
        </div>
      </div>
    </section>
  );
}
