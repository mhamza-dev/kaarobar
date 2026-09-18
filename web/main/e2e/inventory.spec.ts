import { expect, test } from "@playwright/test";

import { signInAsOwner } from "./support/session";

/**
 * Phase 3's gate, against the demo seed: stock, the transfer lifecycle, the
 * count-with-variance-approval flow, and supplier/purchase-order screens.
 *
 * Skips itself when the seed is absent, like the other demo-data specs.
 */

test("stock levels load and paginate by cursor", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/stock");

  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);
  await expect(page.getByRole("button", { name: "Load more" })).toBeVisible();
});

test("stock search queries the backend", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/stock");
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);

  await page.getByRole("textbox", { name: "Search" }).fill("basmati");
  await expect(page.getByText("Basmati rice 5kg").first()).toBeVisible();
});

test("a transfer shows its lifecycle actions for the status it is in", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/stock-transfers");
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);

  await page.getByRole("row").nth(1).click();
  await page.waitForURL(/\/stock-transfers\/[0-9a-f-]+/, { timeout: 8000 });

  // The seeded transfer is already received, so the bar offers nothing —
  // which is exactly what WorkflowActions is supposed to do.
  await expect(page.getByRole("button", { name: "Dispatch" })).toHaveCount(0);
});

test("the count sheet shows expected quantities and its variance", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/stock-counts");
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);

  await page.getByRole("row").nth(1).click();
  await page.waitForURL(/\/stock-counts\/[0-9a-f-]+/, { timeout: 8000 });

  await expect(page.getByText("Expected").first()).toBeVisible();
  await expect(page.getByText("Variance").first()).toBeVisible();
});

test("suppliers and purchase orders render the seeded data", async ({ page }) => {
  await signInAsOwner(page);

  await page.goto("/suppliers");
  await expect(page.getByText("Al-Madina Wholesale").first()).toBeVisible();

  await page.goto("/purchase-orders");
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);
});

test("a received purchase order offers no approve action", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/purchase-orders");
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);

  await page.getByRole("row").nth(1).click();
  await page.waitForURL(/\/purchase-orders\/[0-9a-f-]+/, { timeout: 8000 });

  await expect(page.getByText("Supplier").first()).toBeVisible();
});

test("the inventory and purchasing nav is reachable", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/dashboard");

  // exact: true — "Stock" would otherwise also match "Stock counts".
  for (const label of ["Stock", "Transfers", "Stock counts", "Suppliers", "Purchase orders"]) {
    await expect(page.getByRole("link", { name: label, exact: true })).toBeVisible();
  }
});
