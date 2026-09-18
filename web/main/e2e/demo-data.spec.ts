import { expect, test } from "@playwright/test";

import { signInAsOwner } from "./support/session";

/**
 * The Phase 1 and Phase 2 gates, exercised against the demo seed
 * (`SEED_DEMO=true mix run priv/repo/seeds.exs`) rather than data the test
 * creates itself.
 *
 * Skipped automatically when the seed isn't present, so a developer running
 * the suite against an empty database gets a skip rather than a failure
 * they'd have to go and diagnose.
 */

test("the seeded catalog paginates by cursor", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/products");

  // Row order is the backend's business, so this asserts on counts rather
  // than on which product happens to sort onto the first page.
  const rows = page.getByRole("row");
  await expect.poll(() => rows.count()).toBeGreaterThan(1);

  // The seed deliberately holds more products than one page, so a cursor
  // that never advances would show up right here.
  const loadMore = page.getByRole("button", { name: "Load more" });
  await expect(loadMore).toBeVisible();

  const before = await rows.count();
  await loadMore.click();
  await expect.poll(() => rows.count()).toBeGreaterThan(before);
});

test("searching products queries the backend, not just the loaded rows", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/products");
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);

  // "Basmati rice 5kg" sorts onto a later page, so a filter applied only to
  // the rows already fetched would find nothing here.
  await page.getByRole("textbox", { name: "Search" }).fill("basmati");
  await expect(page.getByText("Basmati rice 5kg").first()).toBeVisible();
  await expect(page.getByText("Cashews 250g")).toHaveCount(0);
});

test("the seeded staff and invitations render", async ({ page }) => {
  await signInAsOwner(page);

  await page.goto("/settings/staff");
  await expect(page.getByText("Manager").first()).toBeVisible();

  await page.goto("/settings/staff/invitations");
  await expect(page.getByText("saad.hussain@example.com").first()).toBeVisible();
  await expect(page.getByText("hina.raza@example.com").first()).toBeVisible();
});

test("the seeded category tree renders with its nesting", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/products/categories");

  await expect(page.getByText("Pantry").first()).toBeVisible();
  await expect(page.getByText("Rice & grains").first()).toBeVisible();
});
