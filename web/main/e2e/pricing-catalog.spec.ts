import { expect, test } from "@playwright/test";

import { apiAs } from "./support/api";
import { signInAsOwner, switchBusiness } from "./support/session";

/**
 * B2's gate: taxes and tax groups, catalog set-up (brands, units, options),
 * a variant matrix and an extra barcode on a product, a price list with a
 * price on it, a code-only promotion, and add-ons on a restaurant dish.
 *
 * Everything made here is cleaned up or harmless: the promotion needs a
 * code, so it never changes a price in another spec.
 */

const suffix = () => Date.now().toString().slice(-5);

test("a tax goes into a new tax group", async ({ page }) => {
  const tax = `E2E levy ${suffix()}`;
  const group = `E2E group ${suffix()}`;
  await signInAsOwner(page);
  await page.goto("/settings/taxes");

  await page.getByRole("tab", { name: "Taxes" }).click();
  await page.getByRole("button", { name: "New tax" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(tax);
  await dialog.getByLabel("On receipts").fill("LEVY");
  await dialog.getByLabel("Rate").fill("2.5");
  await dialog.getByRole("button", { name: "Add tax" }).click();
  // Typed as percent, stored as a fraction, shown as percent again.
  await expect(page.getByRole("row").filter({ hasText: tax }).getByText("2.5%")).toBeVisible();

  await page.getByRole("tab", { name: "Tax groups" }).click();
  await page.getByRole("button", { name: "New group" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(group);
  await dialog.getByRole("checkbox", { name: new RegExp(tax) }).click();
  await dialog.getByRole("button", { name: "Add group" }).click();
  const row = page.getByRole("row").filter({ hasText: group });
  await expect(row.getByText("LEVY 2.5%")).toBeVisible();

  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete group" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("tab", { name: "Taxes" }).click();
  await page.getByRole("row").filter({ hasText: tax }).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete tax" }).click();
  await expect(page.getByRole("row").filter({ hasText: tax })).toHaveCount(0);
});

test("options build a variant matrix, and a variant takes an extra barcode", async ({ page }) => {
  const option = `E2E Size ${suffix()}`;
  const barcode = `29${Date.now().toString().slice(-10)}`;
  await signInAsOwner(page);

  await page.goto("/products/setup");
  await page.getByRole("tab", { name: "Variant options" }).click();
  await page.getByLabel("New option name").fill(option);
  await page.getByRole("button", { name: "Add option" }).click();
  for (const value of ["S", "M", "L"]) {
    await page.getByLabel(`New ${option} value`).fill(value);
    await page.getByLabel(`New ${option} value`).press("Enter");
    await expect(page.locator("section").filter({ hasText: option }).getByText(value, { exact: true })).toBeVisible();
  }

  const api = await apiAs(page);
  const product = await api.post("/products", { name: `E2E Tee ${suffix()}`, kind: "item", price: "1500.00" });
  await page.goto(`/products/${product.id}`);

  await page.getByRole("button", { name: "From options" }).click();
  const matrix = page.getByRole("dialog", { name: "Build variants from options" });
  const values = matrix.locator("fieldset").filter({ hasText: option });
  for (const value of ["S", "M", "L"]) await values.getByRole("button", { name: value, exact: true }).click();
  await matrix.getByRole("button", { name: "Build 3 variants" }).click();
  await expect(page.getByText("3 variants added")).toBeVisible();

  await page.getByRole("row").filter({ hasText: /\bM\b/ }).first().click();
  const barcodes = page.getByRole("dialog", { name: /Barcodes for/ });
  await barcodes.getByLabel("Barcode").fill(barcode);
  await barcodes.getByRole("button", { name: "Add" }).click();
  await expect(barcodes.getByText(barcode)).toBeVisible();
});

test("a price list sets its own price for a product", async ({ page }) => {
  const name = `E2E Wholesale ${suffix()}`;
  await signInAsOwner(page);
  await page.goto("/price-lists");
  await page.getByRole("button", { name: "New price list" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(name);
  await page.getByRole("dialog").getByRole("button", { name: "Add list" }).click();
  await page.waitForURL(/\/price-lists\/[0-9a-f-]+$/);

  await page.getByLabel("Product").click();
  await page.getByPlaceholder("Search the catalog…").fill("Basmati rice 5kg");
  await page.getByRole("option", { name: /^Basmati rice 5kg/ }).click();
  await page.getByLabel("Price").fill("1750");
  await page.getByRole("button", { name: "Set price" }).click();
  const row = page.getByRole("row").filter({ hasText: "Basmati rice 5kg" });
  await expect(row.getByText(/Rs\s1,750/)).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete list" }).click();
  await page.waitForURL(/\/price-lists$/);
  await expect(page.getByText(name)).toHaveCount(0);
});

test("a code-only promotion is added and removed", async ({ page }) => {
  const name = `E2E ten off ${suffix()}`;
  await signInAsOwner(page);
  await page.goto("/promotions");
  await page.getByRole("button", { name: "New promotion" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Percentage").fill("10");
  await dialog.getByLabel("Code").fill(`E2E${suffix()}`);
  await dialog.getByRole("button", { name: "Add promotion" }).click();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row.getByText("10% off")).toBeVisible();

  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete promotion" }).click();
  await expect(row).toHaveCount(0);
});

test("an add-on group is attached to a dish", async ({ page }) => {
  const group = `E2E Spice ${suffix()}`;
  await signInAsOwner(page);
  await switchBusiness(page, "Karahi Corner");

  await page.goto("/products/setup");
  await page.getByRole("tab", { name: "Add-ons" }).click();
  await page.getByRole("button", { name: "New group" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(group);
  await page.getByRole("dialog").getByRole("button", { name: "Add group" }).click();
  await page.getByLabel(`New choice in ${group}`, { exact: true }).fill("Extra hot");
  await page.getByLabel(`Extra cost for the new choice in ${group}`).fill("50");
  await page.getByLabel(`New choice in ${group}`, { exact: true }).press("Enter");
  await expect(page.locator("section").filter({ hasText: group }).getByText("Extra hot")).toBeVisible();

  await page.goto("/products");
  await page.getByRole("textbox", { name: "Search" }).fill("Chicken tikka");
  await page.getByRole("row").filter({ hasText: "Chicken tikka" }).first().click();
  await page.getByLabel("Add-on group to attach").click();
  await page.getByRole("option", { name: group }).click();
  await page.getByRole("button", { name: "Attach" }).click();
  await expect(page.getByText(/Extra hot \+Rs\s50/)).toBeVisible();

  // Clean up: off the dish, then the group itself.
  await page.locator("li").filter({ hasText: group }).getByRole("button", { name: "Remove" }).click();
  await page.goto("/products/setup");
  await page.getByRole("tab", { name: "Add-ons" }).click();
  await page.locator("section").filter({ hasText: group }).getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete group" }).click();
});
