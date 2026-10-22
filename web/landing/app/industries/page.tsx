import type { Metadata } from "next";
import { Check } from "lucide-react";
import Link from "next/link";

import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { PageIntro } from "@/components/section-heading";
import { industries } from "@/lib/content";
import { getCatalogue, longestTrial } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Industries",
  description:
    "Kaarobar for retail and grocery, restaurants and cafés, salons and clinics, laundry and repair, pharmacies and agri suppliers, rentals and professional services.",
  alternates: { canonical: "/industries" },
};

export default async function IndustriesPage() {
  const trialDays = longestTrial(await getCatalogue());

  return (
    <>
      <section className="py-16 sm:py-24">
        <Container>
          <PageIntro eyebrow="Industries" title="Made for your kind of business">
            Tell Kaarobar what you run when you sign up, and it switches on the tools that business
            needs. A café gets tables and a kitchen display; a salon gets a diary; a pharmacy gets batch
            and expiry tracking it can&apos;t skip.
          </PageIntro>
          <nav aria-label="Industries" className="mx-auto mt-12 flex max-w-4xl flex-wrap justify-center gap-2">
            {industries.map((industry) => (
              <Link
                key={industry.id}
                href={`#${industry.id}`}
                className="rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink-muted hover:border-brand/40 hover:text-ink"
              >
                {industry.title}
              </Link>
            ))}
          </nav>
        </Container>
      </section>

      <Container className="grid gap-6 pb-8 md:grid-cols-2">
        {industries.map((industry) => (
          <section
            key={industry.id}
            id={industry.id}
            aria-labelledby={`${industry.id}-heading`}
            className="flex flex-col rounded-2xl border border-line bg-surface p-6 sm:p-8"
          >
            <span className="flex size-12 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
              <industry.icon className="size-6" aria-hidden />
            </span>
            <h2 id={`${industry.id}-heading`} className="mt-6 text-2xl font-semibold tracking-tight text-ink">
              {industry.title}
            </h2>
            <p className="mt-2 text-ink-muted">{industry.summary}</p>

            <h3 className="mt-6 text-sm font-semibold text-ink">What&apos;s switched on</h3>
            <ul className="mt-3 flex flex-col gap-2">
              {industry.includes.map((item) => (
                <li key={item} className="flex gap-3 text-ink">
                  <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>

            <h3 className="mt-6 text-sm font-semibold text-ink">Who it&apos;s for</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {industry.examples.map((example) => (
                <li key={example} className="rounded-full bg-surface-muted px-3 py-1 text-sm text-ink-muted">
                  {example}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </Container>

      <Container className="py-8 text-center text-ink-muted">
        Don&apos;t see your business? Most fit one of these closely —{" "}
        <Link href="/contact" className="font-medium text-brand-ink hover:underline">
          ask us
        </Link>{" "}
        and we&apos;ll tell you honestly whether Kaarobar suits it.
      </Container>

      <CtaBand trialDays={trialDays} />
    </>
  );
}
