"use client";

import { ArrowRight } from "lucide-react";
import NextLink from "next/link";

import Link from "@/components/ui/Link";
import { solutions, solutionHref } from "@/lib/solutions";
import { routes } from "@/lib/navigation";

export default function SolutionsHub() {
  return (
    <section className="relative overflow-hidden bg-bg-primary py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2563eb12,transparent_65%)]" />

      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-3xl text-center">
          <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            Solutions
          </span>
          <h1 className="mt-8 text-5xl font-bold leading-tight text-heading md:text-6xl">
            Ways Kaarobar fits how you actually run shops.
          </h1>
          <p className="mt-6 text-lg leading-8 text-body">
            From owning several businesses to branch tills, books, payroll, and
            FBR Tier-1—pick a topic and dig in.
          </p>
        </div>

        <div className="mt-16 grid gap-6 md:grid-cols-2">
          {solutions.map((solution) => (
            <NextLink
              key={solution.slug}
              href={solutionHref(solution.slug)}
              className="group rounded-2xl border border-border bg-card p-8 shadow-sm transition hover:-translate-y-1 hover:border-brand/30 hover:shadow-lg"
            >
              <p className="text-sm font-semibold text-brand">{solution.badge}</p>
              <h2 className="mt-3 text-2xl font-bold text-heading">
                {solution.label}
              </h2>
              <p className="mt-3 leading-7 text-body">{solution.subhead}</p>
              <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand">
                Learn more
                <ArrowRight
                  size={16}
                  className="transition group-hover:translate-x-0.5"
                />
              </span>
            </NextLink>
          ))}
        </div>

        <div className="mt-14 flex justify-center">
          <Link href={routes.signup} size="lg" endIcon={<ArrowRight size={18} />}>
            Start Free Trial
          </Link>
        </div>
      </div>
    </section>
  );
}
