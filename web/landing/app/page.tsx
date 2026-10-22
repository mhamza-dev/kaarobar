import {
  ArrowRight,
  BadgeCheck,
  Check,
  Download,
  FileDown,
  Landmark,
  LifeBuoy,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";
import Link from "next/link";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { FaqList } from "@/components/faq-list";
import { PlanCards, PlansUnavailable } from "@/components/plan-cards";
import { PlatformCards } from "@/components/platform-cards";
import { ProductMock } from "@/components/product-mock";
import { SectionHeading } from "@/components/section-heading";
import { featureAreas, generalFaqs, industries } from "@/lib/content";
import { getCatalogue, longestTrial } from "@/lib/plans";
import { signUpUrl } from "@/lib/site";

const steps = [
  {
    icon: Sparkles,
    title: "Pick a plan and sign up",
    detail: "Create your account in a couple of minutes. Your free trial starts straight away, with no card.",
  },
  {
    icon: Store,
    title: "Set up your shop",
    detail: "Tell us what kind of business you run, add your products and taxes, and invite your staff.",
  },
  {
    icon: Download,
    title: "Sell from anywhere",
    detail: "Use the web app at the counter, the desktop till, or your phone — all on the same account.",
  },
];

const promises = [
  {
    icon: LifeBuoy,
    title: "A failed card never closes your shop",
    detail: "If a payment fails you keep working for 14 days while you sort it out. We remind you; we don't lock you out.",
  },
  {
    icon: FileDown,
    title: "Your data is yours",
    detail: "Export your records any time — even after your subscription ends.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    detail: "Roles and permissions for every person, two-step sign-in, and an audit log of every sensitive action.",
  },
  {
    icon: Landmark,
    title: "Made for Pakistan",
    detail: "Prices in rupees, JazzCash and Easypaisa, inclusive or exclusive tax, and FBR invoice reporting.",
  },
];

export default async function HomePage() {
  const catalogue = await getCatalogue();
  const trialDays = longestTrial(catalogue);
  const highlights = featureAreas.slice(0, 6);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-0 -z-10 h-[38rem] bg-gradient-to-b from-brand-tint/70 to-transparent"
        />
        <Container className="grid items-center gap-14 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-muted">
              <BadgeCheck className="size-4 text-brand-ink" aria-hidden />
              Point of sale and business management
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
              Run your whole business from one place.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-pretty text-ink-muted sm:text-xl">
              Sales, stock, purchasing, customers and reports for shops, restaurants, salons and service
              businesses — on the web, your desktop and your phone.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink href={signUpUrl()} size="lg">
                Start your free trial <ArrowRight className="size-4" aria-hidden />
              </ButtonLink>
              <ButtonLink href="/pricing" variant="secondary" size="lg">
                See pricing
              </ButtonLink>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
              {[
                trialDays > 0 ? `${trialDays}-day free trial` : "Free trial",
                "No card needed",
                "Cancel any time",
              ].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <Check className="size-4 text-success" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <ProductMock />
        </Container>
      </section>

      {/* Industries */}
      <section aria-labelledby="industries-heading" className="border-y border-line bg-surface-muted py-16">
        <Container>
          <h2 id="industries-heading" className="text-center text-sm font-semibold text-ink-muted">
            Built for the way your kind of business works
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {industries.map((industry) => (
              <li key={industry.id}>
                <Link
                  href={`/industries#${industry.id}`}
                  className="flex h-full flex-col items-center gap-3 rounded-xl border border-line bg-surface p-4 text-center transition-colors hover:border-brand/40"
                >
                  <industry.icon className="size-6 text-brand-ink" aria-hidden />
                  <span className="text-sm font-medium text-ink">{industry.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* Features */}
      <section aria-labelledby="features-heading" className="py-20 sm:py-28">
        <Container>
          <SectionHeading id="features-heading" eyebrow="Features" title="Everything the counter and the back office need">
            One system instead of a notebook, a spreadsheet and three apps that don&apos;t talk to each other.
          </SectionHeading>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {highlights.map((area) => (
              <Link
                key={area.id}
                href={`/features#${area.id}`}
                className="group flex flex-col rounded-2xl border border-line bg-surface p-6 transition-shadow hover:shadow-lg hover:shadow-brand/5"
              >
                <span className="flex size-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
                  <area.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-ink">{area.title}</h3>
                <p className="mt-2 flex-1 text-ink-muted">{area.summary}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-ink">
                  Learn more
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-10 text-center">
            <ButtonLink href="/features" variant="secondary">
              See every feature
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* Platforms */}
      <section aria-labelledby="platforms-heading" className="bg-surface-muted py-20 sm:py-28">
        <Container>
          <SectionHeading id="platforms-heading" eyebrow="Everywhere you work" title="One account. Every device.">
            Your subscription covers the web, desktop and mobile apps. Sign in anywhere and pick up where you left off.
          </SectionHeading>
          <div className="mt-14">
            <PlatformCards />
          </div>
          <div className="mt-10 text-center">
            <ButtonLink href="/download" variant="secondary">
              Get the apps
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section aria-labelledby="steps-heading" className="py-20 sm:py-28">
        <Container>
          <SectionHeading id="steps-heading" eyebrow="How it works" title="Selling in an afternoon" />
          <ol className="mt-14 grid gap-6 md:grid-cols-3">
            {steps.map((step, index) => (
              <li key={step.title} className="relative rounded-2xl border border-line bg-surface p-6">
                <span className="text-sm font-semibold text-brand-ink">Step {index + 1}</span>
                <step.icon className="mt-4 size-6 text-ink" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-ink-muted">{step.detail}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* Promises */}
      <section aria-labelledby="promises-heading" className="border-y border-line bg-surface-muted py-20 sm:py-28">
        <Container>
          <SectionHeading id="promises-heading" eyebrow="Our promises" title="Fair to the people who use it" />
          <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {promises.map((promise) => (
              <div key={promise.title}>
                <promise.icon className="size-6 text-brand-ink" aria-hidden />
                <h3 className="mt-4 font-semibold text-ink">{promise.title}</h3>
                <p className="mt-2 text-ink-muted">{promise.detail}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Pricing */}
      <section aria-labelledby="pricing-heading" className="py-20 sm:py-28">
        <Container>
          <SectionHeading id="pricing-heading" eyebrow="Pricing" title="Simple plans that grow with you">
            Start small and move up when you open your next branch.
          </SectionHeading>
          <div className="mt-14">
            {catalogue && catalogue.plans.length > 0 ? <PlanCards plans={catalogue.plans} /> : <PlansUnavailable />}
          </div>
          <p className="mt-8 text-center">
            <Link href="/pricing" className="font-medium text-brand-ink hover:underline">
              Compare plans in detail
            </Link>
          </p>
        </Container>
      </section>

      {/* FAQ */}
      <section aria-labelledby="faq-heading" className="pb-4">
        <Container>
          <SectionHeading id="faq-heading" eyebrow="Questions" title="Frequently asked" />
          <div className="mt-12">
            <FaqList faqs={generalFaqs} />
          </div>
        </Container>
      </section>

      <CtaBand trialDays={trialDays} />
    </>
  );
}
