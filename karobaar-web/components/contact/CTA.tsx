"use client";

import { ArrowRight } from "lucide-react";

import Link from "@/components/ui/Link";
import { routes } from "@/lib/navigation";

export default function CTA() {
  return (
    <section className="relative overflow-hidden bg-brand py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff20,transparent_70%)]" />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white backdrop-blur">
          Ready to Grow?
        </span>

        <h2 className="mt-8 text-5xl font-bold leading-tight text-white md:text-6xl">
          Let&apos;s Build Your
          <br />
          Business Together
        </h2>

        <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-blue-100">
          Whether you&apos;re a startup, retailer, manufacturer or enterprise,
          Kaarobar helps simplify operations, automate workflows and accelerate
          growth.
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-5">
          <Link href={routes.signup} size="lg" variant="inverted">
            Start Free Trial
          </Link>

          <Link
            href="/#pricing"
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white hover:text-brand"
            endIcon={<ArrowRight size={18} />}
          >
            View Pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
