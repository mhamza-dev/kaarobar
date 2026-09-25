import { expect, test } from "@playwright/test";

import { seriousA11yViolations } from "./support/a11y";
import { apiAs } from "./support/api";
import { signInAsOwner } from "./support/session";

/**
 * A2's gate: a stock line opens into a sheet with its history and reorder
 * settings, setting a reorder point puts it on the reorder list, and a
 * batch can be pulled from sale and put back.
 */

test("a stock line's sheet shows its history and drives the reorder list", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/stock");
  await page.getByRole("textbox", { name: "Search" }).fill("desi ghee");
  await page.getByRole("row").filter({ hasText: "Main shop" }).filter({ hasText: "Desi ghee" }).click();

  const sheet = page.getByRole("dialog", { name: "Desi ghee 500g" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Available to sell")).toBeVisible();

  await sheet.getByRole("tab", { name: "History" }).click();
  await expect(sheet.getByText("Opening").first()).toBeVisible();

  // A reorder point above what's on hand flags it for reordering.
  await sheet.getByRole("tab", { name: "Reordering" }).click();
  await sheet.getByLabel("Reorder point").fill("500");
  await sheet.getByLabel("Order this many").fill("24");
  await sheet.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Reorder settings saved")).toBeVisible();
  expect(await seriousA11yViolations(page, "stock sheet")).toEqual([]);

  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "To reorder" }).click();
  await expect(page.getByRole("row").filter({ hasText: "Desi ghee 500g" })).toBeVisible();

  // Put it back, so the next run (and the demo) isn't left flagged.
  await page.getByRole("row").filter({ hasText: "Desi ghee 500g" }).click();
  await sheet.getByRole("tab", { name: "Reordering" }).click();
  await sheet.getByLabel("Reorder point").fill("");
  await sheet.getByLabel("Order this many").fill("");
  await sheet.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Reorder settings saved").last()).toBeVisible();
});

test("a batch can be quarantined and released", async ({ page }) => {
  await signInAsOwner(page);

  const api = await apiAs(page);
  const [product] = await api.get("/products", { q: "Basmati rice 5kg" });
  const number = `E2E-${Date.now()}`;
  await api.post("/batches", {
    variant_id: product.variants[0].id,
    batch_number: number,
    expires_on: "2027-03-31",
    received_quantity: "10",
    remaining_quantity: "10",
    unit_cost: "1600.00",
  });

  await page.goto("/batches");
  await page.getByRole("row").filter({ hasText: number }).click();
  const sheet = page.getByRole("dialog", { name: number });
  await expect(sheet.getByText("Can be sold")).toBeVisible();

  await sheet.getByRole("button", { name: "Quarantine" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Quarantine" }).click();
  await expect(sheet.getByRole("button", { name: "Release" })).toBeVisible();

  await sheet.getByRole("button", { name: "Release" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Release" }).click();
  await expect(sheet.getByRole("button", { name: "Quarantine" })).toBeVisible();
});

test("opening stock is recorded against a branch", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/stock");
  await page.getByRole("button", { name: "Opening stock" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Product").click();
  await page.getByPlaceholder("Search the catalog…").fill("brown rice");
  await page.getByRole("option", { name: /Brown rice 1kg/ }).click();
  await dialog.getByLabel("Quantity").fill("3");
  await dialog.getByLabel("Cost each").fill("360");
  await dialog.getByRole("button", { name: "Record stock" }).click();
  await expect(page.getByText("Opening stock recorded")).toBeVisible();
});
