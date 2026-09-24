import { expect, test } from "@playwright/test";

import { signInAsOwner } from "./support/session";

/**
 * Phase 8's gate: the dashboard leads with today's figures, reports chart
 * the seeded sales, CSV exports come from the backend with its filename,
 * and documents (receipt, statement) preview as the backend renders them.
 */

test("the dashboard leads with today's net sales", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/dashboard");
  await expect(page.getByText("Net sales today")).toBeVisible();
  await expect(page.getByRole("img", { name: /Net sales for the last 14 days/ })).toBeVisible();
});

test("reports chart the period and export it as the backend's CSV", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/reports");
  await page.getByRole("button", { name: "30 days" }).click();
  await expect(page.getByRole("img", { name: /Net sales by day/ })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV" }).first().click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^daily.*\.csv$/);

  await page.getByRole("tab", { name: "Payments" }).click();
  await expect(page.getByText("Cash").first()).toBeVisible();
});

test("a sale's receipt previews as the backend renders it", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/sales");
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);
  await page.getByRole("row").nth(1).click();
  await page.waitForURL(/\/sales\/[0-9a-f-]+/);

  await page.getByRole("button", { name: "Receipt" }).click();
  const frame = page.frameLocator("iframe[title^='Receipt']");
  await expect(frame.locator("body")).toContainText(/Total/i, { timeout: 10000 });
});
