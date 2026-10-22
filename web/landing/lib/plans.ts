import "server-only";

/**
 * The plan catalogue, from the API's public `GET /plans` — the same list the
 * web app's billing screen shows, so a price on this site is never a copy
 * that has drifted.
 *
 * Cached for five minutes. A price change shows up here within that, and a
 * busy pricing page doesn't become load on the API. When the API can't be
 * reached the caller gets `null` and says so, rather than inventing prices.
 */

export type Plan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  interval: "month" | "year" | string;
  currency: string;
  amount: string | null;
  trial_days: number | null;
  features: string[];
  /** A `null` value is unlimited. Absent is unlimited too. */
  limits: Record<string, number | null>;
};

export type Catalogue = { plans: Plan[]; checkoutEnabled: boolean };

const API_URL = (process.env.KAAROBAR_API_URL ?? "http://localhost:4000/api/v1").replace(/\/+$/, "");

export async function getCatalogue(): Promise<Catalogue | null> {
  try {
    const response = await fetch(`${API_URL}/plans`, {
      headers: { accept: "application/json" },
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;

    const body = (await response.json()) as {
      data: Plan[];
      meta?: { checkout_enabled?: boolean };
    };
    return { plans: body.data, checkoutEnabled: body.meta?.checkout_enabled ?? false };
  } catch {
    return null;
  }
}

/** The longest trial on offer, for "N-day free trial" copy; 0 when there's none. */
export function longestTrial(catalogue: Catalogue | null): number {
  return Math.max(0, ...(catalogue?.plans ?? []).map((plan) => plan.trial_days ?? 0));
}
