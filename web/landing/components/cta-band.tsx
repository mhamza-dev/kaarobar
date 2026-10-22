import { ArrowRight } from "lucide-react";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { signUpUrl } from "@/lib/site";

export function CtaBand({ trialDays }: { trialDays: number }) {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="relative overflow-hidden rounded-3xl bg-[#1f52bd] px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden="true"
            className="absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-32 -left-16 size-80 rounded-full bg-[#2d6df6]/60 blur-3xl"
          />
          <h2 className="relative text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
            Open your shop on Kaarobar today
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-white/85">
            {trialDays > 0
              ? `Start a ${trialDays}-day free trial — no card needed. Set up in minutes and make your first sale today.`
              : "Set up in minutes and make your first sale today."}
          </p>
          <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href={signUpUrl()} variant="inverse" size="lg">
              Start free trial <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink
              href="/contact"
              size="lg"
              className="border border-white/30 bg-transparent text-white hover:bg-white/10"
              variant="ghost"
            >
              Talk to us
            </ButtonLink>
          </div>
        </div>
      </Container>
    </section>
  );
}
