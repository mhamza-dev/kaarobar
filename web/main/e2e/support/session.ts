import { expect, test, type Page } from "@playwright/test";

export const OWNER_EMAIL = process.env.SEED_DEMO_EMAIL ?? "owner@kaarobar.test";
export const OWNER_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? "kaarobar-demo-2026";

/**
 * Signs in as the demo owner, for the specs that run against the seed.
 *
 * Deliberately distinguishes three outcomes rather than skipping on any
 * failure to reach the dashboard:
 *
 *   * the backend rejected the credentials → the seed isn't there, skip;
 *   * the login request never left the page → the dev server hadn't
 *     hydrated the form yet, so click again rather than blaming the seed;
 *   * anything else → fail loudly.
 *
 * The earlier version skipped on every failure, which meant a genuinely
 * broken login looked like an absent fixture — a test that passes by not
 * running is worse than one that fails.
 */
export async function signInAsOwner(page: Page): Promise<void> {
  let lastStatus: number | null = null;
  let attempts = 0;

  page.on("response", (response) => {
    if (response.url().includes("/auth/login")) lastStatus = response.status();
  });

  const submit = async () => {
    attempts += 1;
    await page.goto("/login");
    // Waiting for the button to be enabled is the hydration signal: before
    // React attaches, clicking it does nothing at all.
    const button = page.getByRole("button", { name: "Sign in" });
    await expect(button).toBeEnabled({ timeout: 15000 });

    await page.getByLabel("Email").fill(OWNER_EMAIL);
    await page.getByLabel("Password", { exact: true }).fill(OWNER_PASSWORD);
    await button.click();

    return page
      .waitForURL(/\/dashboard/, { timeout: 10000 })
      .then(() => true)
      .catch(() => false);
  };

  let landed = await submit();

  if (!landed && lastStatus === null) {
    // The form never sent anything — retry once through a fresh load.
    landed = await submit();
  }

  test.skip(
    !landed && lastStatus === 401,
    "Demo seed not present — run SEED_DEMO=true mix run priv/repo/seeds.exs",
  );

  if (!landed) {
    throw new Error(
      `Sign-in failed after ${attempts} attempt(s): last /auth/login status ${lastStatus}, url ${page.url()}`,
    );
  }
}
