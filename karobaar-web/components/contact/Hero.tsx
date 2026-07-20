"use client";

import Link from "@/components/ui/Link";
import { ArrowRight, Headphones, MessageCircle } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-bg-primary py-32">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2563eb15,transparent_70%)]" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-20 lg:grid-cols-2">
          {/* Left */}

          <div>
            <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
              Contact Us
            </span>

            <h1 className="mt-8 text-5xl font-bold leading-tight text-heading md:text-7xl">
              We&apos;d Love
              <br />
              To Hear From You
            </h1>

            <p className="mt-8 max-w-2xl text-lg leading-8 text-body">
              Whether you have a question, need technical support, want to
              schedule a demo, or simply want to learn more about Kaarobar—we&apos;re
              here to help.
            </p>

            <div className="mt-12 flex flex-wrap gap-4">
              <Link
                href="#contact-form"
                size="lg"
                endIcon={<ArrowRight size={18} />}
              >
                Send a Message
              </Link>

              <Link href="/#pricing" size="lg" variant="outline">
                View Pricing
              </Link>
            </div>
          </div>

          {/* Right */}

          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-8 shadow-lg">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <Headphones size={30} />
              </div>

              <h3 className="mt-8 text-2xl font-bold text-heading">
                Dedicated Support
              </h3>

              <p className="mt-4 leading-8 text-body">
                Our team is ready to assist with onboarding, technical questions
                and product guidance.
              </p>
            </div>

            <div className="rounded-3xl border border-border bg-card p-8 shadow-lg">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                <MessageCircle size={30} />
              </div>

              <h3 className="mt-8 text-2xl font-bold text-heading">
                Quick Responses
              </h3>

              <p className="mt-4 leading-8 text-body">
                We aim to respond to all inquiries within one business day.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
