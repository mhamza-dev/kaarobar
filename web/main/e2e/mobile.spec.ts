import { expect, test, type Page } from "@playwright/test";

import { signInAsOwner, switchBusiness } from "./support/session";

/**
 * Phase 9's responsive gate at phone width (390px): no screen scrolls
 * sideways — tables fold into cards or scroll inside their own container,
 * never the page — and the menu drawer behaves like the modal it is.
 */

test.use({ viewport: { width: 390, height: 844 }, actionTimeout: 15_000 });

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
  "/batches",
  "/suppliers",
  "/purchase-orders",
  "/purchase-orders/new",
  "/goods-receipts",
  "/supplier-bills",
  "/purchase-returns",
  "/settings/staff",
  "/settings/staff/invitations",
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

async function sidewaysOverflow(page: Page, route: string): Promise<string | null> {
  await page.goto(route);
  await page.waitForLoadState("networkidle").catch(() => {});
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  return overflow > 1 ? `${route} scrolls sideways by ${overflow}px` : null;
}

test("no screen scrolls sideways on a phone", async ({ page }) => {
  test.setTimeout(300_000);
  await signInAsOwner(page);

  const problems: string[] = [];
  for (const route of CORE_ROUTES) {
    const problem = await sidewaysOverflow(page, route);
    if (problem) problems.push(problem);
  }
  for (const [business, routes] of VERTICAL_ROUTES) {
    await switchBusiness(page, business);
    for (const route of routes) {
      const problem = await sidewaysOverflow(page, route);
      if (problem) problems.push(problem);
    }
  }

  expect(problems).toEqual([]);
});

test("the menu drawer closes on Escape and after navigating", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/dashboard");

  const menu = page.getByRole("button", { name: "Open menu" });
  const drawer = page.getByRole("dialog", { name: "Menu" });

  await menu.click();
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(menu).toBeFocused();

  await menu.click();
  await drawer.getByRole("link", { name: "Customers" }).first().click();
  await page.waitForURL(/\/customers/);
  await expect(drawer).toBeHidden();
});
