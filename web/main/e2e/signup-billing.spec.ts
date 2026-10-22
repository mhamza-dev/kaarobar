import { expect, test } from "@playwright/test";

/**
 * The purchase path from the marketing site: a pricing page link carries
 * `?plan=`, the sign-up starts that plan's trial, the welcome screen says
 * so, and the billing screen shows it. Stripe itself is never reached —
 * card checkout is exercised by the backend's tests against a stub.
 */

function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

test("signing up from the pricing page starts that plan's trial", async ({ page }) => {
  const suffix = uniqueSuffix();

  await page.goto("/register?plan=premium");
  await page.getByLabel("Your name").fill("Bilal Ahmed");
  await page.getByLabel("Email").fill(`e2e-plan-${suffix}@kaarobar.test`);
  await page.getByLabel("Password", { exact: true }).fill("a-good-long-password");
  await page.getByLabel("Company name").fill(`Ahmed & Sons ${suffix}`);
  await page.getByLabel("First shop's name").fill(`Ahmed Electronics ${suffix}`);
  await page.getByLabel("What kind of business is it?").click();
  await page.getByRole("option").first().click();

  // The plan the pricing page named is the one selected.
  await expect(page.getByLabel("Plan")).toContainText("Premium");
  await page.getByRole("button", { name: "Start free trial" }).click();

  await expect(page).toHaveURL(/\/welcome/, { timeout: 15_000 });
  await expect(page.getByText("Kaarobar Premium")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Use Kaarobar everywhere" })).toBeVisible();

  await page.getByRole("link", { name: "Manage subscription" }).click();
  await expect(page).toHaveURL(/\/settings\/billing/);
  await expect(page.getByText(/Free trial — \d+ days left/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Current plan" })).toBeVisible();
});

test("an emailed confirmation link that's been used says so", async ({ page }) => {
  await page.goto("/confirm-email/not-a-real-token");
  await expect(page.getByRole("heading", { name: "Link not valid" })).toBeVisible();
});

test("an emailed password-reset link opens the reset form", async ({ page }) => {
  await page.goto("/reset-password/some-token");
  await expect(page.getByRole("heading", { name: "Set a new password" })).toBeVisible();
});
