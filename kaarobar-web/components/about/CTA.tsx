"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";

import Link from "@/components/ui/Link";
import KaarobarLogo from "@/components/brand/KaarobarLogo";
import { routes } from "@/lib/navigation";

const points = [
  "No card needed to start the trial",
  "We’ll help you get set up",
  "Real people on support",
];

export default function CTA() {
  return (
    <section className="relative overflow-hidden bg-brand py-28 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff20,transparent_70%)]" />

      <div className="relative mx-auto max-w-5xl px-6 text-center">
        <div className="mb-6 flex justify-center">
          <KaarobarLogo size={56} className="rounded-[12px] ring-2 ring-white/20" />
        </div>
        <span className="rounded-md bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
          Ready when you are
        </span>

        <h2 className="mt-8 text-5xl font-bold leading-tight text-white md:text-6xl">
          Put every shop
          <br />
          under one roof
        </h2>

        <p className="mx-auto mt-8 max-w-3xl text-lg leading-8 text-white/80">
          Join owners who use Kaarobar for the till, the books, and the team—
          without juggling five different tools.
        </p>

        <div className="mt-12 flex flex-col justify-center gap-4 sm:flex-row">
          <Link
            href={routes.signup}
            size="lg"
            variant="inverted"
            endIcon={<ArrowRight size={18} />}
          >
            Start free trial
          </Link>

          <Link
            href={routes.contact}
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white hover:text-brand"
          >
            Talk to us
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
