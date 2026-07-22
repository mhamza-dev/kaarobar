"use client";

import Link from "@/components/ui/Link";
import KaarobarLogo from "@/components/brand/KaarobarLogo";
import { ArrowRight, Headphones, MessageCircle } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-bg-primary py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2563eb15,transparent_70%)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-20 lg:grid-cols-2">
          <div>
            <div className="mb-6">
              <KaarobarLogo size={52} className="rounded-[12px] shadow-brand" />
            </div>
            <span className="rounded-md bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
              Contact
            </span>

            <h1 className="mt-8 text-5xl font-bold leading-tight text-heading md:text-7xl">
              Say hello.
              <br />
              We’ll reply.
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-body">
              Questions about setup, a demo, pricing, or something stuck in the
              product—drop us a note. We read every message.
            </p>

            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="#contact-form"
                size="lg"
                endIcon={<ArrowRight size={18} />}
              >
                Send a message
              </Link>

              <Link href="/#pricing" size="lg" variant="outline">
                See pricing
              </Link>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-md border border-border bg-card p-8 shadow-lg">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-brand-soft text-brand">
                <Headphones size={30} />
              </div>

              <h3 className="mt-8 text-2xl font-bold text-heading">
                Hands-on help
              </h3>

              <p className="mt-4 leading-8 text-body">
                We can walk you through onboarding, tax setup, or how branches
                should be structured for your business.
              </p>
            </div>

            <div className="rounded-md border border-border bg-card p-8 shadow-lg">
              <div className="flex h-16 w-16 items-center justify-center rounded-md bg-brand-soft text-brand">
                <MessageCircle size={30} />
              </div>

              <h3 className="mt-8 text-2xl font-bold text-heading">
                Usually within a day
              </h3>

              <p className="mt-4 leading-8 text-body">
                We aim to get back within one business day—often sooner.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
