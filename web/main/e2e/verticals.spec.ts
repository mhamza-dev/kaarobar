import { expect, test } from "@playwright/test";

import { signInAsOwner, switchBusiness } from "./support/session";

/**
 * Phase 6's gate, against the demo seed's vertical businesses: each one
 * sees its own screens and only those, and the core flow of each works end
 * to end — seat a table and fire it to the kitchen, book a salon visit,
 * take in laundry and move it to ready.
 *
 * Names are suffixed per run so reruns never collide with what an earlier
 * run left behind.
 */

const suffix = () => Date.now().toString().slice(-6);

test("a grocery sees no vertical screens; a restaurant sees floor and kitchen", async ({
  page,
}) => {
  await signInAsOwner(page);
  await switchBusiness(page, "Bilal Kiryana Store");
  const nav = page.locator("aside");
  await expect(nav.getByRole("link", { name: "Kitchen" })).toHaveCount(0);
  await expect(nav.getByRole("link", { name: "Floor" })).toHaveCount(0);

  await switchBusiness(page, "Karahi Corner");
  await expect(nav.getByRole("link", { name: "Floor" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Kitchen" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Diary" })).toHaveCount(0);
});

test("a typed URL for another vertical says so instead of failing", async ({ page }) => {
  await signInAsOwner(page);
  await switchBusiness(page, "Bilal Kiryana Store");
  await page.goto("/kitchen");
  await expect(page.getByText("Not part of this business")).toBeVisible();
});

test("seat a table, order, and fire it to the kitchen board", async ({ page }) => {
  const table = `E2E${suffix()}`;

  await signInAsOwner(page);
  await switchBusiness(page, "Karahi Corner");

  // A station has to exist before anything can be fired.
  await page.goto("/kitchen/stations");
  await expect.poll(() => page.getByRole("row").count()).toBeGreaterThan(0);
  if ((await page.getByRole("cell", { name: /Tandoor|E2E grill/ }).count()) === 0) {
    await page.getByRole("button", { name: "New station" }).click();
    await page.getByRole("dialog").getByLabel("Name").fill("E2E grill");
    await page.getByRole("button", { name: "Add station" }).click();
  }

  await page.goto("/dining/tables");
  await page.getByRole("button", { name: "New table" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(table);
  await page.getByRole("button", { name: "Add table" }).click();
  await expect(page.getByText("Table added")).toBeVisible();

  await page.goto("/dining");
  await page.getByRole("button", { name: new RegExp(`^${table}`) }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Seat" }).click();
  await page.waitForURL(/\/dining\/sessions\/[0-9a-f-]+/, { timeout: 10000 });

  await page.getByRole("textbox", { name: /search/i }).fill("naan");
  await page.getByRole("button", { name: /^Garlic naan/ }).click();
  await expect(page.getByText("1 × Garlic naan")).toBeVisible();

  await page.getByRole("button", { name: "Send to kitchen" }).click();
  await expect(page.getByText("Sent to the kitchen")).toBeVisible();

  await page.goto("/kitchen");
  const card = page.getByRole("article", { name: new RegExp(table) });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Start" }).click();
  await expect(card.getByRole("button", { name: "Ready" })).toBeVisible();
});

test("book a salon visit into a free slot", async ({ page }) => {
  const stylist = `E2E Stylist ${suffix()}`;

  await signInAsOwner(page);
  await switchBusiness(page, "Studio Noor");

  await page.goto("/appointments/resources");
  await page.getByRole("button", { name: "New resource" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(stylist);
  await page.getByRole("button", { name: "Add resource" }).click();
  await expect(page.getByText("Resource added")).toBeVisible();

  await page.goto("/appointments");
  await page.getByRole("button", { name: "Next day" }).click();
  await page.getByRole("button", { name: "Book" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill("Walk-in Sana");

  await dialog.getByLabel("Service").click();
  await page.getByRole("option", { name: /Manicure/ }).click();
  await dialog.getByLabel("With").click();
  await page.getByRole("option", { name: stylist }).click();
  await dialog.getByLabel("Time").click();
  await page.getByRole("option").first().click();
  await dialog.getByRole("button", { name: "Book" }).click();

  await expect(page.getByText("Visit booked")).toBeVisible();
  const column = page.locator("section").filter({ hasText: stylist });
  await expect(column.getByText("Walk-in Sana")).toBeVisible();
  await column.getByRole("button", { name: "Confirm" }).click();
  await expect(column.getByText("Confirmed")).toBeVisible();
});

test("take laundry in and move it to ready", async ({ page }) => {
  const tag = `T${suffix()}`;

  await signInAsOwner(page);
  await switchBusiness(page, "Crisp Laundry");

  await page.goto("/service-jobs/new");
  await page.getByLabel("Name").first().fill("Walk-in Bilal");
  await page.getByLabel("Item").fill("Shalwar kameez");
  await page.getByLabel("Price").fill("350");
  await page.getByLabel("Tag").fill(tag);
  await page.getByRole("button", { name: "Take in" }).click();
  await page.waitForURL(/\/service-jobs\/[0-9a-f-]+/, { timeout: 10000 });

  await page.getByRole("button", { name: "Start work" }).click();
  await expect(page.getByText("Work started", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Mark ready" }).click();
  await page.getByRole("dialog").getByLabel("Rack").fill("B-12");
  await page.getByRole("dialog").getByRole("button", { name: "Mark ready" }).click();
  await expect(page.getByText("Ready for collection", { exact: true })).toBeVisible();

  // The counter's lookup finds it by the tag on the ticket.
  await page.goto("/service-jobs");
  await page.getByLabel("Find by ticket tag").fill(tag);
  await page.getByRole("button", { name: "Find job by tag" }).click();
  await page.waitForURL(/\/service-jobs\/[0-9a-f-]+/, { timeout: 10000 });
  await expect(page.getByText("rack B-12")).toBeVisible();
});
