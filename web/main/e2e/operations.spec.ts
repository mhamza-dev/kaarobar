import { expect, request as playwrightRequest, test } from "@playwright/test";

import { seriousA11yViolations } from "./support/a11y";
import { apiAs } from "./support/api";
import { signInAsOwner, switchBusiness } from "./support/session";

/**
 * B4's gate: a delivery goes out and comes back delivered with cash
 * collected; a commission rule is set up; time is logged against a
 * professional-services business — none of the demo verticals tracks
 * time, so the spec makes one on first run and reuses it after.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const suffix = () => Date.now().toString().slice(-5);

test("a delivery goes out and is delivered with cash collected", async ({ page }) => {
  const street = `House ${suffix()}, Street 4, Gulberg`;
  await signInAsOwner(page);
  await switchBusiness(page, "Karahi Corner");
  // A delivery rides on an order: open one, as the phone line would.
  const api = await apiAs(page, "Karahi Corner");
  const [branch] = await api.get("/branches");
  const order = await api.post("/orders", {
    branch_id: branch.id,
    channel: "phone",
    service_mode: "delivery",
    label: street,
  });

  await page.goto("/deliveries");
  await page.getByRole("button", { name: "New delivery" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Order", { exact: true }).click();
  await page.getByRole("option", { name: new RegExp(order.number) }).click();
  await dialog.getByLabel("Address").fill(street);
  await dialog.getByLabel("Phone").fill("03001112233");
  await dialog.getByRole("button", { name: "Add delivery" }).click();

  await page.getByRole("row").filter({ hasText: street }).click();
  const sheet = page.getByRole("dialog", { name: /^DEL/ });
  await sheet.getByLabel("Rider").click();
  await page.getByRole("option").first().click();
  await sheet.getByRole("button", { name: "Assign" }).click();
  await expect(sheet.getByText("Assigned").first()).toBeVisible();
  expect(await seriousA11yViolations(page, "delivery sheet")).toEqual([]);

  await sheet.getByRole("button", { name: "Picked up" }).click();
  await sheet.getByRole("button", { name: "Delivered" }).click();
  await page.getByLabel(/Cash collected/).fill("850");
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(sheet.getByText("Delivered").first()).toBeVisible();
  await expect(sheet.getByText(/Rs\s850/)).toBeVisible();
});

test("a commission rule is set up and removed", async ({ page }) => {
  const name = `E2E stylists ${suffix()}`;
  await signInAsOwner(page);
  await switchBusiness(page, "Studio Noor");
  await page.goto("/commissions");
  await expect(page.getByLabel("From")).toBeVisible();

  await page.getByRole("tab", { name: "Rules" }).click();
  await page.getByRole("button", { name: "New rule" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByLabel("Rate").fill("7.5");
  await dialog.getByRole("button", { name: "Add rule" }).click();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row.getByText("7.5% of the sale")).toBeVisible();

  await row.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete rule" }).click();
  await expect(row).toHaveCount(0);
});

test("time is logged and counted as unbilled", async ({ page }) => {
  await signInAsOwner(page);

  // A business that tracks time, made once.
  const cookies = await page.context().cookies();
  const token = decodeURIComponent(cookies.find((cookie) => cookie.name === "kb_session")!.value);
  const api = await playwrightRequest.newContext();
  const auth = { Authorization: `Bearer ${token}` };
  const me = (await (await api.get(`${API_URL}/me`, { headers: auth })).json()).data;
  const headers = { ...auth, "X-Organization-Id": me.organization.id };
  const businesses = (await (await api.get(`${API_URL}/businesses`, { headers })).json()).data;
  if (!businesses.some((business: { name: string }) => business.name === "E2E Consulting")) {
    const created = await api.post(`${API_URL}/businesses`, {
      headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
      data: { name: "E2E Consulting", business_type: "professional_services" },
    });
    expect(created.ok()).toBeTruthy();
  }
  await api.dispose();

  await page.reload();
  await switchBusiness(page, "E2E Consulting");
  await page.goto("/time");
  const description = `Contract review ${suffix()}`;

  await page.getByRole("button", { name: "Log time" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Work").fill(description);
  await dialog.getByLabel("Hours").fill("1");
  await dialog.getByLabel("Minutes").fill("30");
  await dialog.getByLabel("Hourly rate").fill("4000");
  await dialog.getByRole("button", { name: "Log time" }).click();

  const row = page.getByRole("row").filter({ hasText: description });
  await expect(row.getByText("1h 30m")).toBeVisible();
  await expect(row.getByText("To bill")).toBeVisible();
  await expect(row.getByText(/Rs\s6,000/)).toBeVisible();

  await page.getByRole("tab", { name: "By person" }).click();
  await expect(page.getByRole("cell", { name: "Demo Owner" })).toBeVisible();

  await page.getByRole("tab", { name: "Time logged" }).click();
  await row.getByRole("button", { name: "Remove" }).click();
  await expect(row).toHaveCount(0);
});
