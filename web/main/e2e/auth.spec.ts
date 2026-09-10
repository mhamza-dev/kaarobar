import { expect, test } from "@playwright/test";

/**
 * Phase 0's gate: register → land on the dashboard inside the app shell →
 * sign out → sign back in.
 */

/**
 * Every run needs a fresh identity: emails are unique per user, and an
 * organization's slug is derived from its name and unique platform-wide, so
 * a fixed company name would collide with the previous run's.
 */
function uniqueSuffix() {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

const PASSWORD = "a-good-long-password";

test("an unauthenticated visitor is sent to the login screen", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("register, land on the dashboard, sign out, sign back in", async ({ page }) => {
  const suffix = uniqueSuffix();
  const email = `e2e-${suffix}@kaarobar.test`;
  const companyName = `Khan Traders ${suffix}`;
  const shopName = `Khan Kiryana ${suffix}`;

  // --- Register ---
  await page.goto("/register");
  await page.getByLabel("Your name").fill("Ayesha Khan");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Company name").fill(companyName);
  await page.getByLabel("First shop's name").fill(shopName);

  // The business-type select is a Base UI listbox, not a native <select>.
  await page.getByLabel("What kind of business is it?").click();
  await page.getByRole("option").first().click();

  await page.getByRole("button", { name: "Create account" }).click();

  // --- Dashboard, inside the shell ---
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Welcome back, Ayesha/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  // The business the bootstrap auto-selected shows in the shell — proving
  // the session settled on a real tenant, not just an organization.
  await expect(page.getByText(shopName).first()).toBeVisible();

  // --- Sign out ---
  await page.getByRole("button", { name: /Ayesha Khan/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/, { timeout: 15_000 });

  // --- Sign back in ---
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Welcome back, Ayesha/ })).toBeVisible();
});

test("a wrong password is refused without leaking whether the account exists", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("nobody@kaarobar.test");
  await page.getByLabel("Password", { exact: true }).fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByText(/Email or password is incorrect/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});
