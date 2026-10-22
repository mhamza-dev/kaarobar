import type { Metadata } from "next";
import { Check, Minus } from "lucide-react";

import { Container } from "@/components/container";
import { CtaBand } from "@/components/cta-band";
import { FaqList } from "@/components/faq-list";
import { PlanCards, PlansUnavailable } from "@/components/plan-cards";
import { PageIntro, SectionHeading } from "@/components/section-heading";
import { limitLabels, moduleGroups, pricingFaqs } from "@/lib/content";
import { getCatalogue, longestTrial, type Plan } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Kaarobar plans for one shop, several branches, or the whole group. Every plan starts with a free trial, no card needed.",
  alternates: { canonical: "/pricing" },
};

function LimitCell({ value }: { value: number | null | undefined }) {
  return <>{value === null || value === undefined ? "Unlimited" : value}</>;
}

function Included({ yes, plan, label }: { yes: boolean; plan: string; label: string }) {
  return yes ? (
    <>
      <Check className="mx-auto size-5 text-success" aria-hidden />
      <span className="sr-only">{`${label} included in ${plan}`}</span>
    </>
  ) : (
    <>
      <Minus className="mx-auto size-5 text-ink-muted/50" aria-hidden />
      <span className="sr-only">{`${label} not included in ${plan}`}</span>
    </>
  );
}

/**
 * Every module any plan includes, grouped, against every plan. Only modules
 * with a friendly name are listed — a backend key with no label is internal
 * plumbing, not something to sell.
 */
function Comparison({ plans }: { plans: Plan[] }) {
  const offered = new Set(plans.flatMap((plan) => plan.features));
  const groups = moduleGroups
    .map((group) => ({
      title: group.title,
      rows: Object.entries(group.modules).filter(([key]) => offered.has(key)),
    }))
    .filter((group) => group.rows.length > 0);

  return (
    // `relative` so the cells' screen-reader-only labels (absolutely
    // positioned) are clipped by this scroller instead of widening the page.
    // Focusable and labelled, so the sideways scroll on a phone works from
    // the keyboard too.
    <div
      role="region"
      aria-label="Plan comparison"
      tabIndex={0}
      className="relative overflow-x-auto rounded-2xl border border-line bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">What each plan includes</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className="w-2/5 p-4 font-semibold text-ink">
              Plan
            </th>
            {plans.map((plan) => (
              <th key={plan.code} scope="col" className="p-4 text-center font-semibold text-ink">
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th colSpan={plans.length + 1} scope="colgroup" className="bg-surface-muted px-4 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
              Size
            </th>
          </tr>
          {Object.entries(limitLabels).map(([key, label]) => (
            <tr key={key} className="border-t border-line">
              <th scope="row" className="p-4 font-normal text-ink">
                {label}
              </th>
              {plans.map((plan) => (
                <td key={plan.code} className="p-4 text-center tabular-nums text-ink">
                  <LimitCell value={plan.limits[key]} />
                </td>
              ))}
            </tr>
          ))}
          {groups.map((group) => (
            <GroupRows key={group.title} title={group.title} rows={group.rows} plans={plans} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GroupRows({ title, rows, plans }: { title: string; rows: Array<[string, string]>; plans: Plan[] }) {
  return (
    <>
      <tr>
        <th colSpan={plans.length + 1} scope="colgroup" className="bg-surface-muted px-4 py-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
          {title}
        </th>
      </tr>
      {rows.map(([key, label]) => (
        <tr key={key} className="border-t border-line">
          <th scope="row" className="p-4 font-normal text-ink">
            {label}
          </th>
          {plans.map((plan) => (
            <td key={plan.code} className="p-4 text-center">
              <Included yes={plan.features.includes(key)} plan={plan.name} label={label} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export default async function PricingPage() {
  const catalogue = await getCatalogue();
  const plans = catalogue?.plans ?? [];
  const trialDays = longestTrial(catalogue);

  return (
    <>
      <section className="py-16 sm:py-24">
        <Container>
          <PageIntro eyebrow="Pricing" title="Pick the plan that fits today">
            {trialDays > 0
              ? `Every plan starts with a ${trialDays}-day free trial — no card needed. Move up or down whenever your business changes.`
              : "Move up or down whenever your business changes."}
          </PageIntro>
          <div className="mt-14">{plans.length > 0 ? <PlanCards plans={plans} /> : <PlansUnavailable />}</div>
          <p className="mt-8 text-center text-sm text-ink-muted">
            Prices are per organization, per {plans[0]?.interval ?? "month"}. One subscription covers the web,
            desktop and mobile apps.
          </p>
        </Container>
      </section>

      {plans.length > 0 && (
        <section aria-labelledby="compare-heading" className="border-t border-line bg-surface-muted py-16 sm:py-24">
          <Container>
            <SectionHeading id="compare-heading" title="Compare plans" />
            <div className="mt-12">
              <Comparison plans={plans} />
            </div>
          </Container>
        </section>
      )}

      <section aria-labelledby="pricing-faq-heading" className="py-16 sm:py-24">
        <Container>
          <SectionHeading id="pricing-faq-heading" title="Billing questions" />
          <div className="mt-12">
            <FaqList faqs={pricingFaqs(catalogue?.checkoutEnabled ?? false)} />
          </div>
        </Container>
      </section>

      <CtaBand trialDays={trialDays} />
    </>
  );
}
