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
          Prefer to talk it through?
        </span>

        <h2 className="mt-8 text-5xl font-bold leading-tight text-white md:text-6xl">
          Tell us how you run
          <br />
          your shops
        </h2>

        <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-blue-100">
          Whether you’re opening a second branch or already juggling several
          businesses, we’re happy to walk through Kaarobar with you.
        </p>

        <div className="mt-12 flex flex-wrap justify-center gap-5">
          <Link href={routes.signup} size="lg" variant="inverted">
            Start free trial
          </Link>

          <Link
            href="/#pricing"
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white hover:text-brand"
            endIcon={<ArrowRight size={18} />}
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
