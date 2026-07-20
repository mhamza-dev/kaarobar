"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";

import Link from "@/components/ui/Link";
import { routes } from "@/lib/navigation";

const points = [
  "No Credit Card Required",
  "Free Setup & Migration",
  "24/7 Customer Support",
];

export default function CTA() {
  return (
    <section className="relative overflow-hidden bg-brand py-28 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff20,transparent_70%)]" />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
          Ready to Get Started?
        </span>

        <h2 className="mt-8 text-5xl font-bold leading-tight md:text-6xl">
          Transform the Way
          <br />
          You Run Your Business
        </h2>

        <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/80">
          Join businesses using Kaarobar to manage POS, inventory, accounting,
          HR, payroll and AI-powered insights from one modern platform.
        </p>

        <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href={routes.signup}
            size="lg"
            variant="inverted"
            endIcon={<ArrowRight size={18} />}
          >
            Start Free Trial
          </Link>

          <Link
            href={routes.contact}
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white hover:text-brand"
          >
            Contact Sales
          </Link>
        </div>

        <div className="mt-14 flex flex-wrap justify-center gap-8">
          {points.map((item) => (
            <div key={item} className="flex items-center gap-3">
              <CheckCircle2 size={20} />
              <span className="text-white/90">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
