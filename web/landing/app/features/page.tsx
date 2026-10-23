import type { Metadata } from "next";
import { Check } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { IntroBackdrop, PageIntro } from "@/components/section-heading";
import { featureAreas } from "@/lib/content";
import { getCatalogue, longestTrial } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Point of sale, stock, purchasing, customer credit, loyalty, industry tools, reports, staff roles, payments and FBR reporting — everything in Kaarobar.",
  alternates: { canonical: "/features" },
};

export default async function FeaturesPage() {
  const trialDays = longestTrial(await getCatalogue());

  return (
    <>
      <section className="relative isolate overflow-hidden py-16 sm:py-24">
        <IntroBackdrop />
        <Container>
          <PageIntro eyebrow="Features" title="Everything you need to run the business">
            From the first scan at the counter to the profit and loss at the end of the month. Each
            business type sees the tools it needs — and none it doesn&apos;t.
          </PageIntro>

          <nav aria-label="Feature areas" className="mx-auto mt-12 flex max-w-4xl flex-wrap justify-center gap-2">
            {featureAreas.map((area) => (
              <Link
                key={area.id}
                href={`#${area.id}`}
                className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-muted hover:border-brand/40 hover:text-ink"
              >
                {area.title}
              </Link>
            ))}
          </nav>
        </Container>
      </section>

      <div className="border-t border-line">
        {featureAreas.map((area, index) => (
          <section
            key={area.id}
            id={area.id}
            aria-labelledby={`${area.id}-heading`}
            className={index % 2 === 1 ? "bg-surface-muted py-16 sm:py-20" : "py-16 sm:py-20"}
          >
            <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
              <div>
                <span className="flex size-12 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
                  <area.icon className="size-6" aria-hidden />
                </span>
                <h2 id={`${area.id}-heading`} className="mt-6 text-3xl font-semibold tracking-tight text-ink">
                  {area.title}
                </h2>
                <p className="mt-4 text-lg text-ink-muted">{area.summary}</p>
              </div>
              <ul className="grid content-start gap-4 sm:grid-cols-2">
                {area.points.map((point) => (
                  <li key={point} className="flex gap-3 rounded-xl border border-line bg-surface p-4 text-ink">
                    <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </Container>
          </section>
        ))}
      </div>

      <CtaBand trialDays={trialDays} />
    </>
  );
}
