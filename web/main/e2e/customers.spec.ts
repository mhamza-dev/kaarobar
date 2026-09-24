import { expect, test } from "@playwright/test";

import { signInAsOwner } from "./support/session";

/**
 * Phase 5's gate, against the demo seed: a customer is created, lands on
 * their own page, takes a payment onto their account, gets a note and a
 * follow-up — and the receivables and follow-up screens load.
 *
 * Each run creates a uniquely named customer, so reruns never collide on
 * the backend's unique-phone constraint.
 */

test("create a customer, record a payment, and add a note", async ({ page }) => {
  const suffix = Date.now().toString().slice(-7);
  const name = `E2E Customer ${suffix}`;

  await signInAsOwner(page);
  await page.goto("/customers");

  await page.getByRole("button", { name: "New customer" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Phone").fill(`0300${suffix}`);
  // Payments are offered only on an account customer (or one who owes).
  await dialog.getByRole("switch", { name: "Allow selling on account" }).click();
  await dialog.getByRole("button", { name: "Create customer" }).click();

  await page.waitForURL(/\/customers\/[0-9a-f-]+/, { timeout: 10000 });
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Taking money puts the account in credit — it shows on the statement.
  await page.getByRole("button", { name: "Record payment" }).click();
  const payment = page.getByRole("dialog");
  await payment.getByLabel("Amount").fill("150");
  await payment.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Payment recorded")).toBeVisible();
  await expect(page.getByRole("cell", { name: "Payment" }).first()).toBeVisible();

  await page.getByRole("tab", { name: "Notes" }).click();
  await page.getByLabel("New note").fill("Prefers delivery after 5pm");
  await page.getByRole("button", { name: "Add note" }).click();
  await expect(page.getByText("Prefers delivery after 5pm")).toBeVisible();

  await page.getByRole("tab", { name: "Follow-ups" }).click();
  await page.getByRole("button", { name: "New follow-up" }).click();
  const followUp = page.getByRole("dialog");
  await followUp.getByLabel("What needs doing").fill("Confirm next order");
  await followUp.getByRole("button", { name: "Add follow-up" }).click();
  await expect(page.getByText("Confirm next order").first()).toBeVisible();
});

test("the customer search goes to the backend", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/customers");
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(1);

  await page.getByRole("textbox", { name: "Search" }).fill("zzzz-no-such-customer");
  await expect.poll(() => page.getByRole("row").count()).toBeLessThanOrEqual(2);
});

test("receivables and follow-ups load", async ({ page }) => {
  await signInAsOwner(page);

  await page.goto("/receivables");
  await expect(page.getByText("Total receivable")).toBeVisible();

  await page.goto("/follow-ups");
  await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible();
});
