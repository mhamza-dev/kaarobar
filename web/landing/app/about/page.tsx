import type { Metadata } from "next";
import { Compass, HeartHandshake, Lock, Scale } from "lucide-react";

import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { IntroBackdrop, PageIntro, SectionHeading } from "@/components/section-heading";
import { getCatalogue, longestTrial } from "@/lib/plans";

export const metadata: Metadata = {
  title: "About",
  description: "Why we built Kaarobar, and what we hold ourselves to.",
  alternates: { canonical: "/about" },
};

const values = [
  {
    icon: Compass,
    title: "Built for how shops really work",
    detail:
      "A kiryana store, a restaurant and a laundry don't run the same way, so Kaarobar doesn't pretend they do. Each business type gets its own tools.",
  },
  {
    icon: Scale,
    title: "Fair billing",
    detail:
      "Nobody loses their till over one declined card. A failed payment starts a grace period, not a lockout, and cancelling keeps what you've paid for.",
  },
  {
    icon: Lock,
    title: "Your data, protected and portable",
    detail:
      "Each business's records are kept apart from every other's, sensitive actions are logged, and you can export everything whenever you want.",
  },
  {
    icon: HeartHandshake,
    title: "Plain answers",
    detail:
      "Clear prices, clear terms, and a straight answer when Kaarobar isn't the right fit for you.",
  },
];

export default async function AboutPage() {
  const trialDays = longestTrial(await getCatalogue());

  return (
    <>
      <section className="relative isolate overflow-hidden py-16 sm:py-24">
        <IntroBackdrop />
        <Container>
          <PageIntro eyebrow="About us" title="Kaarobar means business">
            <span lang="ur">کاروبار</span> — kaarobar — is the Urdu word for business. We&apos;re building the
            system we wish every small business had: one place for the counter, the stockroom and the books.
          </PageIntro>
        </Container>
      </section>

      <section aria-labelledby="story-heading" className="border-y border-line bg-surface-muted py-16 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <h2 id="story-heading" className="text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
            Small businesses deserve better than a notebook and five apps
          </h2>
          <div className="flex flex-col gap-5 text-lg text-ink-muted">
            <p>
              Most shops we know run on a mix of a cash register, a credit notebook, a spreadsheet for stock and a
              phone full of supplier messages. None of them talk to each other, so the owner is the only one who
              knows how the business is really doing — and only at the end of the day.
            </p>
            <p>
              Kaarobar brings those pieces together. A sale updates the stock, the customer&apos;s balance and the
              day&apos;s takings at once, whichever device it was rung up on, so owners and their teams can see the
              same picture at any moment.
            </p>
            <p>
              We started with the businesses around us — grocers, restaurants, salons, laundries, pharmacies and
              agri suppliers — and built each of their ways of working into one product, rather than asking them
              to bend to a till made for someone else.
            </p>
          </div>
        </Container>
      </section>

      <section aria-labelledby="values-heading" className="py-16 sm:py-24">
        <Container>
          <SectionHeading id="values-heading" eyebrow="What we hold ourselves to" title="Our principles" />
          <div className="mt-14 grid gap-6 sm:grid-cols-2">
            {values.map((value) => (
              <div key={value.title} className="rounded-2xl border border-line bg-surface p-6 sm:p-8">
                <value.icon className="size-6 text-brand-ink" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-ink">{value.title}</h3>
                <p className="mt-2 text-ink-muted">{value.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <CtaBand trialDays={trialDays} />
    </>
  );
}
