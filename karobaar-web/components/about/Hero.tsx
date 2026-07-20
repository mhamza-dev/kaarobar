"use client";

import Link from "@/components/ui/Link";
import { ArrowRight, Sparkles } from "lucide-react";

import { routes } from "@/lib/navigation";

export default function AboutHero() {
  return (
    <section className="relative overflow-hidden bg-bg-primary py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2563eb10,transparent_65%)]" />

      <div className="relative mx-auto max-w-6xl px-6 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
          <Sparkles size={16} />
          About Kaarobar
        </div>

        <h1 className="mt-8 text-5xl font-bold leading-tight text-heading md:text-7xl">
          Building the Future
          <br />
          of Business Management
        </h1>

        <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-body">
          Kaarobar is an AI-powered Business Operating System designed to
          simplify operations, automate workflows, and help businesses grow with
          confidence.
        </p>

        <div className="mt-10">
          <Link
            href={routes.signup}
            size="lg"
            endIcon={<ArrowRight size={18} />}
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </section>
  );
}
