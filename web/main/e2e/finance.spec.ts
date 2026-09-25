import { expect, test } from "@playwright/test";

import { signInAsOwner } from "./support/session";

/**
 * Phase 7's gate: an owner configures a payment gateway without its secrets
 * ever coming back, sets up fiscal reporting, and sees the subscription and
 * plans. Secrets are write-only end to end — the list only ever says
 * whether they are set.
 */

test("add a payment gateway; its keys are stored but never shown", async ({ page }) => {
  const name = `E2E JazzCash ${Date.now().toString().slice(-6)}`;

  await signInAsOwner(page);
  await page.goto("/settings/payments");

  // One provider of each kind per business: clear out an earlier run's.
  const earlier = page.getByRole("row").filter({ hasText: "JazzCash" });
  // Let the list load before counting — an unloaded table has no rows, and
  // it shows skeletons rather than any "Loading…" text to wait out.
  await page.waitForLoadState("networkidle");
  while ((await earlier.count()) > 0) {
    const before = await earlier.count();
    await earlier.first().getByRole("button", { name: "Remove" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remove provider" }).click();
    await expect(earlier).toHaveCount(before - 1);
  }

  await page.getByRole("button", { name: "Add provider" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name at the till").fill(name);
  await dialog.getByLabel("Merchant ID").fill("MC12345");
  await dialog.getByLabel("Password", { exact: true }).fill("secret-password");
  await dialog.getByLabel("Integrity salt").fill("secret-salt");
  await dialog.getByRole("button", { name: "Add provider" }).click();

  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row.getByText("Keys set")).toBeVisible();
  await expect(page.getByText("secret-password")).toHaveCount(0);

  await row.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("dialog").getByLabel("Password", { exact: true })).toHaveValue("");
});

test("fiscal reporting needs its registration before it can be switched on", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/settings/fiscal");

  await page.getByLabel("Authority").click();
  await page.getByRole("option", { name: /FBR/ }).click();

  // Start from blank registration fields — a save persists them.
  await page.getByLabel("NTN / taxpayer number").fill("");
  await page.getByLabel("POS ID").fill("");
  const reporting = page.getByRole("switch", { name: "Report every sale" });
  if ((await reporting.getAttribute("aria-checked")) !== "true") await reporting.click();
  await page.getByRole("button", { name: "Save" }).click();
  // Refused on the client — nothing reached the backend.
  await expect(page.getByText("Needed before reporting can start").first()).toBeVisible();

  // Save the registration with reporting left OFF. Never switch it on in
  // e2e: every later sale would then be sent to the FBR sandbox for real.
  await page.getByLabel("NTN / taxpayer number").fill("1234567-8");
  await page.getByLabel("POS ID").fill("POS-01");
  await reporting.click();
  await expect(reporting).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Fiscal settings saved")).toBeVisible();
  await expect(page.getByText("Not reporting to a tax authority")).toBeVisible();
});

test("the subscription screen shows the plans", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/settings/billing");

  for (const plan of ["Starter", "Standard", "Premium"]) {
    await expect(page.getByText(plan, { exact: true }).first()).toBeVisible();
  }
});
