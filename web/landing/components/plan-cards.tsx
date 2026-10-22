import { Check } from "lucide-react";

import { ButtonLink } from "@/components/button-link";
import { limitLabels, moduleGroups } from "@/lib/content";
import { formatPrice } from "@/lib/format";
import type { Plan } from "@/lib/plans";
import { signUpUrl, site } from "@/lib/site";

const LABELS: Record<string, string> = Object.assign({}, ...moduleGroups.map((group) => group.modules));

/** The middle plan is the one most businesses want, and the one we point at. */
export function recommendedCode(plans: Plan[]): string | undefined {
  return plans[Math.floor((plans.length - 1) / 2)]?.code;
}

function limitLine(key: string, value: number | null | undefined): string {
  const label = (limitLabels[key] ?? key).toLowerCase();
  if (value === null || value === undefined) return `Unlimited ${label}`;
  return `${value} ${value === 1 ? label.replace(/es$|s$/, "") : label}`;
}

/**
 * What a plan adds over the one before it, so each card reads as a step up
 * rather than a list of forty modules.
 */
function highlights(plan: Plan, previous?: Plan): string[] {
  // In the order the groups list them — everyday selling first — not the
  // API's alphabetical order, which reads as random on a card.
  const added = Object.keys(LABELS).filter(
    (key) => plan.features.includes(key) && !(previous?.features ?? []).includes(key),
  );
  return added.map((key) => LABELS[key]).slice(0, previous ? 6 : 7);
}

export function PlanCards({ plans }: { plans: Plan[] }) {
  const recommended = recommendedCode(plans);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {plans.map((plan, index) => {
        const previous = plans[index - 1];
        const featured = plan.code === recommended && plans.length > 1;
        const limitKeys = Object.keys(limitLabels);

        return (
          <article
            key={plan.id}
            aria-labelledby={`plan-${plan.code}`}
            className={`relative flex flex-col rounded-2xl border bg-surface p-6 sm:p-8 ${
              featured ? "border-brand shadow-xl shadow-brand/10 ring-1 ring-brand" : "border-line"
            }`}
          >
            {featured && (
              <p className="absolute -top-3 left-6 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-on-brand">
                Most popular
              </p>
            )}
            <h3 id={`plan-${plan.code}`} className="text-lg font-semibold text-ink">
              {plan.name}
            </h3>
            {plan.description && <p className="mt-2 min-h-12 text-sm text-ink-muted">{plan.description}</p>}
            <p className="mt-6 flex items-baseline gap-1">
              <span className="text-4xl font-semibold tracking-tight text-ink tabular-nums">
                {formatPrice(plan.amount, plan.currency)}
              </span>
              <span className="text-sm text-ink-muted">/{plan.interval}</span>
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              {plan.trial_days ? `${plan.trial_days}-day free trial, no card needed` : "Billed every " + plan.interval}
            </p>

            <ButtonLink
              href={signUpUrl(plan.code)}
              variant={featured ? "primary" : "secondary"}
              className="mt-6 w-full"
            >
              {plan.trial_days ? "Start free trial" : `Get ${plan.name}`}
            </ButtonLink>

            <ul className="mt-8 flex flex-col gap-3 text-sm">
              {limitKeys.map((key) => (
                <li key={key} className="flex gap-3 text-ink">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {limitLine(key, plan.limits[key])}
                </li>
              ))}
              {previous && (
                <li className="pt-2 text-xs font-semibold tracking-wide text-ink-muted uppercase">
                  Everything in {previous.name}, plus
                </li>
              )}
              {highlights(plan, previous).map((label) => (
                <li key={label} className="flex gap-3 text-ink">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {label}
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}

/** Said instead of prices when the API can't be reached — never made-up numbers. */
export function PlansUnavailable() {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-line bg-surface p-8 text-center">
      <h3 className="text-lg font-semibold text-ink">Prices are loading slowly</h3>
      <p className="mt-2 text-ink-muted">
        We couldn&apos;t fetch our current plans just now. You can still start your free trial and pick a
        plan inside the app, or email{" "}
        <a href={`mailto:${site.contactEmail}`} className="font-medium text-brand-ink hover:underline">
          {site.contactEmail}
        </a>
        .
      </p>
      <ButtonLink href={signUpUrl()} className="mt-6">
        Start free trial
      </ButtonLink>
    </div>
  );
}
