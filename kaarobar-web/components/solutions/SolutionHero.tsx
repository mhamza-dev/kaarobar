"use client";

import { ArrowRight } from "lucide-react";

import Link from "@/components/ui/Link";
import type { Solution } from "@/lib/solutions";
import { routes } from "@/lib/navigation";

type SolutionHeroProps = {
  solution: Solution;
};

export default function SolutionHero({ solution }: SolutionHeroProps) {
  return (
    <section className="relative overflow-hidden bg-bg-primary py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2563eb12,transparent_65%)]" />

      <div className="relative mx-auto max-w-6xl px-6">
        <p className="text-sm font-semibold text-brand">
          <Link href={routes.solutions} variant="link" className="!p-0">
            Solutions
          </Link>
          <span className="text-muted"> / {solution.label}</span>
        </p>

        <span className="mt-6 inline-flex rounded-md bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
          {solution.badge}
        </span>

        <h1 className="mt-8 max-w-4xl text-5xl font-bold leading-tight text-heading md:text-6xl">
          {solution.headline}
        </h1>

        <p className="mt-6 max-w-3xl text-lg leading-8 text-body">
          {solution.subhead}
        </p>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link href={routes.signup} size="lg" endIcon={<ArrowRight size={18} />}>
            Start Free Trial
          </Link>
          <Link href={routes.contact} size="lg" variant="outline">
            Talk to sales
          </Link>
        </div>
      </div>
    </section>
  );
}
