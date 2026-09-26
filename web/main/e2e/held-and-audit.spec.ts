import { expect, test } from "@playwright/test";

import { seriousA11yViolations } from "./support/a11y";
import { signInAsOwner } from "./support/session";

/**
 * B5's gate: a basket is parked at the till and picked back up to take
 * payment; the audit log finds what was just done, by a family of actions.
 */

test("a parked basket is picked back up and paid for", async ({ page }) => {
  const label = `E2E customer ${Date.now().toString().slice(-5)}`;
  await signInAsOwner(page);
  await page.goto("/pos");

  await page.getByLabel("Scan or search").fill("Cooking oil 1L");
  await page.getByRole("button", { name: /Cooking oil 1L/i }).first().click();
  await expect(page.getByRole("button", { name: "Add payment" })).toBeEnabled();

  await page.getByRole("button", { name: "Park" }).click();
  await page.getByLabel("Name it").fill(label);
  await page.getByRole("button", { name: "Park basket" }).click();
  await expect(page.getByText("Basket parked")).toBeVisible();
  // The till is free for the next customer.
  await expect(page.getByRole("button", { name: "Park" })).toHaveCount(0);

  await page.getByRole("button", { name: /^Held/ }).click();
  const drawer = page.getByRole("dialog", { name: "Held baskets" });
  const held = drawer.getByRole("listitem").filter({ hasText: label });
  await expect(held).toBeVisible();
  expect(await seriousA11yViolations(page, "held baskets")).toEqual([]);
  await held.getByRole("button", { name: "Take payment" }).click();

  await page.waitForURL(/\/pos\?order=/);
  await expect(page.getByText(/1 × Cooking oil 1L/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add payment" })).toBeEnabled();
  await page.getByLabel("Cash given").fill("1000.00");
  await page.getByRole("button", { name: "Add payment" }).click();
  await page.getByRole("button", { name: "Complete sale" }).click();
  await expect(page.getByText("Change due")).toBeVisible({ timeout: 10000 });
});

test("the audit log finds a family of actions", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/settings/audit-log");
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);

  // "order" finds order.held, order.resumed… — the parking just above.
  await page.getByLabel("Action").fill("order");
  await expect(page.getByRole("cell", { name: /^Order / }).first()).toBeVisible();
  await expect(page.getByRole("cell", { name: /^Sale / })).toHaveCount(0);

  await page.getByRole("cell", { name: /^Order / }).first().click();
  const sheet = page.getByRole("dialog", { name: /^Order / });
  await expect(sheet.getByText("Demo Owner")).toBeVisible();
});
