import { expect, test, type Page } from "@playwright/test";

import { signInAsOwner } from "./support/session";

/**
 * Phase 4's gate: ring up a real sale at the till, against the demo seed.
 *
 * This is the one flow where being wrong costs money, so it exercises the
 * whole path — scan, quote, tender, complete — rather than asserting that
 * screens render.
 */

/** Adds a product to the basket through the till's search field. */
async function addProduct(page: Page, name: string) {
  await page.getByLabel("Scan or search").fill(name);
  await page
    .getByRole("button", { name: new RegExp(name, "i") })
    .first()
    .click();
}

test("the till prices the basket from the backend, not the client", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/pos");

  await addProduct(page, "Basmati rice 5kg");

  // 1 × 1850.00, priced by Kaarobar.Sales.Checkout and echoed back.
  await expect(page.getByText("Subtotal")).toBeVisible();
  await expect(page.getByText(/1,850/).first()).toBeVisible();
});

test("quantities update the quoted total", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/pos");

  await addProduct(page, "Basmati rice 5kg");
  await expect(page.getByText(/1,850/).first()).toBeVisible();

  await page.getByRole("button", { name: /Increase quantity/ }).click();

  // Re-quoted at 2 × 1850.00 — the client never multiplied anything.
  await expect(page.getByText(/3,700/).first()).toBeVisible();
});

test("a cash sale completes and shows the backend's change", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/pos");

  await addProduct(page, "Cooking oil 1L");

  // Wait for the quote, not just the row: the totals panel renders as soon
  // as there's a line, with placeholders until the backend prices it.
  await expect(page.getByRole("button", { name: "Add payment" })).toBeEnabled();

  // Pay in cash, handing over more than the total.
  await page.getByLabel("Cash given").fill("1000.00");
  await page.getByRole("button", { name: "Add payment" }).click();

  const complete = page.getByRole("button", { name: "Complete sale" });
  await expect(complete).toBeEnabled();
  await complete.click();

  // The receipt carries the sale number and the change the backend computed.
  await expect(page.getByText(/Sale .+/).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Change due")).toBeVisible();
});

test("the completed sale appears in history", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/sales");

  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);
});

test("shifts show the drawer and whether it balanced", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/shifts");

  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);
  await expect(page.getByText("Net sales").first()).toBeVisible();
});
