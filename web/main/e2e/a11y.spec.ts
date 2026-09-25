import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { signInAsOwner, switchBusiness } from "./support/session";

/**
 * Phase 9's accessibility gate: every main screen, in each vertical, has
 * no serious or critical WCAG 2.1 A/AA violation. The Next.js dev overlay
 * is excluded — it isn't part of the app and isn't in a production build.
 *
 * Kept as one sweep rather than a test per page so a regression lists
 * every screen it touched at once, which is usually the clue to which
 * shared component caused it.
 */

const CORE_ROUTES = [
  "/dashboard",
  "/reports",
  "/pos",
  "/sales",
  "/shifts",
  "/payments",
  "/customers",
  "/customers/groups",
  "/follow-ups",
  "/receivables",
  "/products",
  "/products/new",
  "/products/categories",
  "/stock",
  "/stock-transfers",
  "/stock-counts",
  "/suppliers",
  "/purchase-orders",
  "/settings/staff",
  "/settings/roles",
  "/settings/businesses",
  "/settings/branches",
  "/settings/organization",
  "/settings/loyalty",
  "/settings/payments",
  "/settings/billing",
  "/settings/fiscal",
  "/settings/taxes",
  "/settings/profile",
  "/products/setup",
  "/price-lists",
  "/promotions",
  "/refund-requests",
  "/gift-cards",
];

const VERTICAL_ROUTES: Array<[business: string, routes: string[]]> = [
  ["Karahi Corner", ["/dining", "/dining/tables", "/kitchen", "/kitchen/stations"]],
  ["Studio Noor", ["/appointments", "/appointments/resources", "/queue"]],
  ["Crisp Laundry", ["/service-jobs", "/service-jobs/new"]],
];

async function violationsOn(page: Page, route: string): Promise<string[]> {
  await page.goto(route);
  await page.waitForLoadState("networkidle").catch(() => {});

  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("nextjs-portal")
    .analyze();

  return result.violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map(
      (violation) =>
        `${route}: ${violation.id} (${violation.nodes.length}) — ${violation.nodes[0]?.target.join(" ")}`,
    );
}

test("no serious or critical accessibility violations on any main screen", async ({ page }) => {
  test.setTimeout(300_000);
  await signInAsOwner(page);

  const found: string[] = [];
  for (const route of CORE_ROUTES) found.push(...(await violationsOn(page, route)));
  for (const [business, routes] of VERTICAL_ROUTES) {
    await switchBusiness(page, business);
    for (const route of routes) found.push(...(await violationsOn(page, route)));
  }

  expect(found).toEqual([]);
});
