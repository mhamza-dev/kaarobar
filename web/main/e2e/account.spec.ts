import { expect, request as playwrightRequest, test } from "@playwright/test";

import { seriousA11yViolations } from "./support/a11y";
import { generateTotp } from "./support/totp";

/**
 * B1's gate, on a freshly registered account so nothing it changes touches
 * the demo owner: profile, two-step sign-in turned on through the UI (QR
 * and key shown, code checked) and off again, the device list, and a
 * password change.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const PASSWORD = "e2e-account-pass-9";

test("an account is managed from its own page", async ({ page }) => {
  const suffix = Date.now().toString().slice(-8);
  const email = `e2e-account-${suffix}@kaarobar.test`;

  const api = await playwrightRequest.newContext();
  const registered = await api.post(`${API_URL}/auth/register`, {
    data: {
      user: { name: `Account ${suffix}`, email, password: PASSWORD },
      organization: { name: `Account Traders ${suffix}` },
      business: { name: `Account Shop ${suffix}`, business_type: "grocery" },
    },
  });
  expect(registered.ok()).toBeTruthy();
  await api.dispose();

  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled({ timeout: 15000 });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/dashboard/);

  // The user menu's Profile link used to go nowhere.
  await page.goto("/settings/profile");
  await expect(page.getByRole("heading", { name: "Profile and sign-in" })).toBeVisible();
  await expect(page.getByText("This device").first()).toBeVisible();
  expect(await seriousA11yViolations(page, "account page")).toEqual([]);

  await page.getByLabel("Phone").fill("03001234567");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved")).toBeVisible();

  // Two-step sign-in: scan (or type the key), prove it with a code.
  await page.getByRole("button", { name: "Set up" }).click();
  const setup = page.getByRole("dialog", { name: "Set up two-step sign-in" });
  await expect(setup.getByRole("img", { name: /QR code/ })).toBeVisible();
  const key = (await setup.getByLabel("Setup key").textContent())!.trim();
  await setup.getByLabel("Code from the app").fill(generateTotp(key));
  await setup.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByText("Two-step sign-in is on")).toBeVisible();

  await page.getByRole("button", { name: "Turn off" }).click();
  await page.getByLabel("Current password").last().fill(PASSWORD);
  await page.getByRole("dialog").getByRole("button", { name: "Turn off" }).click();
  await expect(page.getByText("Two-step sign-in is off")).toBeVisible();

  // A mistyped current password is refused, on the field.
  const passwordSection = page.locator("section").filter({ hasText: "Change password" });
  await passwordSection.getByLabel("Current password").fill("not-my-password");
  await passwordSection.getByLabel("New password", { exact: true }).fill("a-new-pass-2026");
  await passwordSection.getByLabel("New password again").fill("a-new-pass-2026");
  await passwordSection.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Password changed")).toHaveCount(0);

  await passwordSection.getByLabel("Current password").fill(PASSWORD);
  await passwordSection.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText(/Password changed/)).toBeVisible();
});
