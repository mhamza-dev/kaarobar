import { expect, request, test } from "@playwright/test";

import { generateTotp } from "./support/totp";

const API_URL = process.env.E2E_API_URL ?? "http://localhost:4000/api/v1";
const PASSWORD = "a-good-long-password";

/**
 * The MFA half of Phase 0's gate: a password alone is not a session once
 * TOTP is on — login has to hand back a challenge, and only the right code
 * turns it into a token.
 *
 * Enrollment is done over the API rather than through the UI: the
 * enroll/confirm screens are Phase 1 work, and this test is about the
 * *login* branch, which exists now.
 */
test("a TOTP-enabled account must pass the challenge to sign in", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const email = `e2e-mfa-${suffix}@kaarobar.test`;

  // No baseURL: an absolute path like "/auth/register" would resolve
  // against the origin and drop API_URL's "/api/v1" prefix.
  const api = await request.newContext();

  // --- Register + enable MFA over the API ---
  const registered = await api.post(`${API_URL}/auth/register`, {
    data: {
      user: { email, password: PASSWORD, name: "Bilal Ahmed" },
      organization: { name: `MFA Traders ${suffix}` },
      business: { name: `MFA Shop ${suffix}`, business_type: "grocery" },
    },
  });
  expect(registered.ok()).toBeTruthy();
  const token = (await registered.json()).data.token;
  const auth = { Authorization: `Bearer ${token}` };

  const enrolled = await api.post(`${API_URL}/me/mfa/enroll`, { headers: auth });
  expect(enrolled.ok()).toBeTruthy();

  // The provisioning URI is what a QR code encodes; the secret is its
  // `secret` query param.
  const provisioningUri: string = (await enrolled.json()).data.provisioning_uri;
  const secret = new URL(provisioningUri.replace("otpauth://", "https://")).searchParams.get(
    "secret",
  )!;
  expect(secret).toBeTruthy();

  const confirmed = await api.post(`${API_URL}/me/mfa/confirm`, {
    headers: auth,
    data: { code: generateTotp(secret) },
  });
  expect(confirmed.ok()).toBeTruthy();
  await api.dispose();

  // --- Sign in through the UI: password alone is not enough ---
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/login\/mfa/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: "Two-factor verification" })).toBeVisible();

  // A wrong code is refused, and we stay on the challenge.
  await page.getByLabel("Authenticator code").fill("000000");
  await page.getByRole("button", { name: "Verify" }).click();
  await expect(page).toHaveURL(/\/login\/mfa/);

  // The right code completes the sign-in.
  await page.getByLabel("Authenticator code").fill(generateTotp(secret));
  await page.getByRole("button", { name: "Verify" }).click();

  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Welcome back, Bilal/ })).toBeVisible();
});
