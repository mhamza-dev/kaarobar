import {
  ArrowRight,
  BadgeCheck,
  Check,
  FileDown,
  Landmark,
  LifeBuoy,
  ShieldCheck,
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
import { featureAreas, generalFaqs, industries, type FeatureArea } from "@/lib/content";
import { getCatalogue, longestTrial } from "@/lib/plans";
import { signUpUrl } from "@/lib/site";

const steps = [
  {
    title: "Pick a plan and sign up",
    detail: "Create your account in a couple of minutes. Your free trial starts straight away, with no card.",
  },
  {
    title: "Set up your shop",
    detail: "Tell us what kind of business you run, add your products and taxes, and invite your staff.",
  },
  {
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
          className="absolute inset-0 -z-10 bg-[radial-gradient(60%_55%_at_75%_10%,var(--brand-tint),transparent_70%),radial-gradient(40%_40%_at_0%_0%,var(--brand-tint),transparent_70%)]"
        />
        <div aria-hidden="true" className="bg-grid absolute inset-0 -z-10" />
        <Container className="grid items-center gap-16 pt-14 pb-24 sm:pt-20 lg:grid-cols-[1fr_1.1fr] lg:pt-24 lg:pb-32">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm text-ink-muted shadow-sm">
              <BadgeCheck className="size-4 text-brand-ink" aria-hidden />
              Point of sale and business management
            </p>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
              Run your whole business from <span className="text-brand-ink">one place.</span>
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
      <section aria-labelledby="industries-heading" className="border-y border-line bg-surface-muted py-14">
        <Container>
          <h2 id="industries-heading" className="text-center text-sm font-semibold text-ink-muted">
            Built for the way your kind of business works
          </h2>
          <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {industries.map((industry) => (
              <li key={industry.id}>
                <Link
                  href={`/industries#${industry.id}`}
                  className="group flex h-full flex-col items-center gap-3 rounded-xl border border-line bg-surface p-5 text-center transition hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-lg hover:shadow-brand/5"
                >
                  <span className="flex size-11 items-center justify-center rounded-full bg-brand-tint text-brand-ink transition-colors group-hover:bg-brand group-hover:text-on-brand">
                    <industry.icon className="size-5" aria-hidden />
                  </span>
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
          <div className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {highlights.map((area, index) => (
              <FeatureCard
                key={area.id}
                area={area}
                wide={index === 0 || index === highlights.length - 1}
                visual={index === 0 ? <TillVisual /> : index === highlights.length - 1 ? <ReportsVisual /> : null}
              />
            ))}
            <Link
              href="/features"
              className="group flex flex-col justify-between gap-6 rounded-2xl border border-brand/20 bg-brand-tint p-6 transition hover:border-brand/40"
            >
              <p className="text-lg font-semibold text-ink">
                And a lot more — tables and kitchens, appointments, jobs, hires, quotes and fiscal reporting.
              </p>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-ink">
                See every feature
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </div>
        </Container>
      </section>

      {/* Platforms */}
      <section aria-labelledby="platforms-heading" className="relative overflow-hidden bg-deep py-20 sm:py-28">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(60%_60%_at_15%_0%,rgb(59_130_246/0.45),transparent_70%),radial-gradient(50%_50%_at_100%_100%,rgb(15_23_42/0.45),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)] bg-[linear-gradient(rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[size:44px_44px]"
        />
        <Container className="relative">
          <div className="mx-auto max-w-2xl text-center">
            <p className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide text-white uppercase ring-1 ring-white/20">
              Everywhere you work
            </p>
            <h2
              id="platforms-heading"
              className="mt-4 text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl lg:text-[2.75rem] lg:leading-tight"
            >
              One account. Every device.
            </h2>
            <p className="mt-4 text-lg text-pretty text-white/80">
              Your subscription covers the web, desktop and mobile apps. Sign in anywhere and pick up where you left
              off.
            </p>
          </div>
          <div className="mt-14">
            <PlatformCards inverse />
          </div>
          <div className="mt-10 text-center">
            <ButtonLink href="/download" variant="inverse">
              Get the apps
            </ButtonLink>
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section aria-labelledby="steps-heading" className="py-20 sm:py-28">
        <Container>
          <SectionHeading id="steps-heading" eyebrow="How it works" title="Selling in an afternoon" />
          <div className="relative mt-16">
            <div
              aria-hidden="true"
              className="absolute top-6 right-[16.6%] left-[16.6%] hidden h-px bg-gradient-to-r from-brand/10 via-brand/40 to-brand/10 md:block"
            />
            <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
              {steps.map((step, index) => (
                <li key={step.title} className="flex flex-col items-center text-center">
                  <span className="flex size-12 items-center justify-center rounded-full border-2 border-brand bg-canvas text-lg font-semibold text-brand-ink shadow-lg shadow-brand/15">
                    <span className="sr-only">Step </span>
                    {index + 1}
                  </span>
                  <h3 className="mt-6 text-lg font-semibold text-ink">{step.title}</h3>
                  <p className="mt-2 max-w-xs text-ink-muted">{step.detail}</p>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {/* Promises */}
      <section aria-labelledby="promises-heading" className="border-y border-line bg-surface-muted py-20 sm:py-28">
        <Container>
          <SectionHeading id="promises-heading" eyebrow="Our promises" title="Fair to the people who use it" />
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {promises.map((promise) => (
              <div key={promise.title} className="rounded-2xl border border-line bg-surface p-6">
                <span className="flex size-10 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
                  <promise.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 font-semibold text-ink">{promise.title}</h3>
                <p className="mt-2 text-sm text-ink-muted">{promise.detail}</p>
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

function FeatureCard({ area, wide, visual }: { area: FeatureArea; wide?: boolean; visual?: React.ReactNode }) {
  return (
    <Link
      href={`/features#${area.id}`}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-xl hover:shadow-brand/5 ${
        wide ? "lg:col-span-2 lg:grid lg:grid-cols-[1fr_1fr] lg:gap-8" : ""
      }`}
    >
      <div className="flex flex-col">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <area.icon className="size-5" aria-hidden />
        </span>
        <h3 className="mt-5 text-lg font-semibold text-ink">{area.title}</h3>
        <p className="mt-2 flex-1 text-ink-muted">{area.summary}</p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-ink">
          Learn more
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
      {visual && <div className="mt-6 hidden lg:mt-0 lg:flex lg:items-center">{visual}</div>}
    </Link>
  );
}

/** A tender split, as the till shows it. Decorative. */
function TillVisual() {
  return (
    <div aria-hidden="true" className="w-full rounded-xl border border-line bg-surface-muted p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-ink-muted">Total</span>
        <span className="text-xl font-semibold text-ink tabular-nums">Rs 7,410</span>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-xs">
        {[
          ["Cash", "Rs 5,000"],
          ["JazzCash", "Rs 2,000"],
          ["Store credit", "Rs 410"],
        ].map(([method, amount]) => (
          <li key={method} className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2">
            <span className="font-medium text-ink">{method}</span>
            <span className="text-ink-muted tabular-nums">{amount}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-lg bg-brand py-2 text-center text-xs font-semibold text-on-brand">Complete sale</div>
    </div>
  );
}

/** Takings by hour, as a report draws them. Decorative. */
function ReportsVisual() {
  const hours = [18, 26, 34, 52, 61, 48, 40, 57, 74, 88, 69, 45];
  return (
    <div aria-hidden="true" className="w-full rounded-xl border border-line bg-surface-muted p-4">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-semibold text-ink">Takings by hour</span>
        <span className="text-xs text-ink-muted">Today</span>
      </div>
      <div className="mt-4 flex h-28 items-end gap-1.5">
        {hours.map((height, index) => (
          <span
            key={index}
            className={`flex-1 rounded-t-[4px] ${index === 9 ? "bg-brand" : "bg-brand/35"}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}
