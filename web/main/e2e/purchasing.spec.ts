import { expect, test } from "@playwright/test";

import { seriousA11yViolations, sidewaysOverflow } from "./support/a11y";
import { signInAsOwner } from "./support/session";

/**
 * A1's gate: the purchasing paperwork after the order — receipts, bills,
 * payments, returns — opens into real detail screens and can be moved
 * through its lifecycle, and a supplier opens in a side sheet.
 *
 * Starts from the demo seed's delivered order (AMW-20417 on its receipt).
 * Serial: the supplier's account shows the bill the first test posts.
 */

test.describe.configure({ mode: "serial" });

test("a posted receipt becomes a bill, the bill is posted and paid", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/goods-receipts");
  await page.getByRole("row").filter({ hasText: "Al-Madina" }).first().click();
  await page.waitForURL(/\/goods-receipts\/[0-9a-f-]+$/);

  await expect(page.getByText("Basmati rice 5kg").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /^PO/ })).toBeVisible();
  expect(await seriousA11yViolations(page, "receipt detail")).toEqual([]);

  // The bill starts as the receipt's accepted lines.
  await page.getByRole("button", { name: "Enter bill" }).click();
  const billDialog = page.getByRole("dialog");
  await expect(billDialog.getByText("Cooking oil 1L").first()).toBeVisible();
  // A supplier's invoice number can only be entered once; earlier runs used theirs.
  await billDialog.getByLabel("Their invoice number").fill(`E2E-${Date.now()}`);
  await billDialog.getByRole("button", { name: "Save draft bill" }).click();
  await page.waitForURL(/\/supplier-bills\/[0-9a-f-]+$/);

  await page.getByRole("button", { name: "Post bill" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Post bill" }).click();
  await expect(page.getByText(/posted$/).first()).toBeVisible();

  // Opened from the bill, the payment starts allocated to it in full.
  await page.getByRole("button", { name: "Record payment" }).click();
  const payment = page.getByRole("dialog");
  await expect(payment.getByLabel(/Amount towards/)).not.toHaveValue("");
  await payment.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText(/Payment .* recorded/).first()).toBeVisible();
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
});

test("a return is drafted, then posted out of stock", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/purchase-returns");
  await page.getByRole("button", { name: "New return" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Supplier").click();
  await page.getByRole("option", { name: "Al-Madina Wholesale" }).click();
  await dialog.getByLabel("Reason").fill("Torn bags");
  await dialog.getByLabel("Products going back").fill("sella");
  await dialog.getByRole("button", { name: /Sella rice 5kg/ }).click();
  await dialog.getByRole("button", { name: "Save draft return" }).click();
  await page.waitForURL(/\/purchase-returns\/[0-9a-f-]+$/);

  await expect(page.getByText("Torn bags")).toBeVisible();
  await page.getByRole("button", { name: "Post return" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Post return" }).click();
  await expect(page.getByRole("button", { name: "Post return" })).toHaveCount(0);
});

test("a supplier opens in a sheet with their prices and account", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/suppliers");
  await page.getByRole("row").filter({ hasText: "Al-Madina Wholesale" }).click();

  const sheet = page.getByRole("dialog", { name: "Al-Madina Wholesale" });
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(/\?view=/);
  await expect(sheet.getByText("Imran Sheikh")).toBeVisible();
  expect(await seriousA11yViolations(page, "supplier sheet")).toEqual([]);

  await sheet.getByRole("tab", { name: "Account" }).click();
  await expect(sheet.getByRole("cell", { name: /Bill/ }).first()).toBeVisible();

  // Back closes the sheet, like any page.
  await page.goBack();
  await expect(sheet).toBeHidden();
});

test("the supplier sheet fits a phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAsOwner(page);
  await page.goto("/suppliers");
  await page.getByText("Al-Madina Wholesale").filter({ visible: true }).first().click();

  const sheet = page.getByRole("dialog", { name: "Al-Madina Wholesale" });
  await expect(sheet).toBeVisible();
  const box = await sheet.boundingBox();
  expect(box?.width).toBeLessThanOrEqual(390);
  expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(1);
});
