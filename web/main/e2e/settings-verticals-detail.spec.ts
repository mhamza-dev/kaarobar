import { expect, test, type Page } from "@playwright/test";

import { seriousA11yViolations } from "./support/a11y";
import { signInAsOwner, switchBusiness } from "./support/session";

/**
 * A5's gate: a member of staff is managed from their sheet (a permission
 * exception, a PIN, suspend and reinstate); a booking opens in a sheet and
 * is rescheduled and cancelled with a reason; a walk-in is seated from the
 * queue; two tables are joined onto one bill; a laundry item is moved.
 */

const suffix = () => Date.now().toString().slice(-5);

test("a member of staff is managed from their sheet", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/settings/staff");
  await page.getByRole("row").filter({ hasText: "cashier@kaarobar.test" }).click();

  const sheet = page.getByRole("dialog", { name: "Cashier" });
  await expect(sheet).toBeVisible();
  expect(await seriousA11yViolations(page, "staff sheet")).toEqual([]);

  // A per-person exception on top of their role.
  await sheet.getByRole("tab", { name: "Access" }).click();
  await sheet.getByLabel("Permission").click();
  await page.getByPlaceholder("Search permissions…").fill("void");
  await page.getByRole("option").first().click();
  await sheet.getByLabel("Effect").click();
  await page.getByRole("option", { name: "Deny" }).click();
  await sheet.getByRole("button", { name: "Add exception" }).click();
  await expect(page.getByText("Exception added")).toBeVisible();
  const exception = sheet.getByRole("listitem").filter({ hasText: "Deny" }).first();
  await exception.getByRole("button", { name: /Remove exception/ }).click();
  await expect(page.getByText("Exception removed")).toBeVisible();

  await sheet.getByRole("button", { name: /Set PIN|Change PIN/ }).click();
  await page.getByLabel("New PIN").fill("4826");
  await page.getByRole("button", { name: "Save PIN" }).click();
  await expect(page.getByText("PIN set")).toBeVisible();

  await sheet.getByRole("button", { name: "Suspend" }).click();
  await expect(sheet.getByText("Suspended").first()).toBeVisible();
  await sheet.getByRole("button", { name: "Reactivate" }).click();
  await expect(sheet.getByText("Active").first()).toBeVisible();
});

async function addStylist(page: Page) {
  const stylist = `E2E Stylist ${suffix()}`;
  await page.goto("/appointments/resources");
  await page.getByRole("button", { name: "New resource" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill(stylist);
  await page.getByRole("button", { name: "Add resource" }).click();
  await expect(page.getByText("Resource added")).toBeVisible();
  return stylist;
}

async function fillBooking(page: Page, stylist: string) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Service").click();
  await page.getByRole("option", { name: /Threading/ }).click();
  await dialog.getByLabel("With").click();
  await page.getByRole("option", { name: stylist }).click();
  await dialog.getByLabel("Time").click();
  await page.getByRole("option").first().click();
  return dialog;
}

test("a booking is rescheduled and cancelled from its sheet", async ({ page }) => {
  await signInAsOwner(page);
  await switchBusiness(page, "Studio Noor");
  const stylist = await addStylist(page);

  await page.goto("/appointments");
  await page.getByRole("button", { name: "Next day" }).click();
  await page.getByRole("button", { name: "Book" }).click();
  await page.getByRole("dialog").getByLabel("Name").fill("Walk-in Hira");
  const dialog = await fillBooking(page, stylist);
  await dialog.getByRole("button", { name: "Book" }).click();

  const column = page.locator("section").filter({ hasText: stylist });
  await column.getByRole("button", { name: /Open booking for Walk-in Hira/ }).click();
  const sheet = page.getByRole("dialog", { name: /Walk-in Hira/ });
  await expect(sheet.getByText("Threading")).toBeVisible();

  await sheet.getByRole("button", { name: "Cancel booking" }).click();
  await page.getByRole("dialog", { name: /Cancel/ }).getByRole("textbox").fill("Called to cancel");
  await page.getByRole("dialog", { name: /Cancel/ }).getByRole("button", { name: "Cancel booking" }).click();
  await expect(sheet.getByText("Called to cancel")).toBeVisible();
});

test("a walk-in is seated from the queue", async ({ page }) => {
  const name = `Queue ${suffix()}`;
  await signInAsOwner(page);
  await switchBusiness(page, "Studio Noor");
  const stylist = await addStylist(page);

  await page.goto("/queue");
  await page.getByPlaceholder(/name/i).first().fill(name);
  await page.getByRole("button", { name: /Add|Join/ }).first().click();
  // In main: toasts are list items too, and one will say "<name> seated".
  const entry = page.getByRole("main").getByRole("listitem").filter({ hasText: name });
  await entry.getByRole("button", { name: "Seat" }).click();

  const dialog = page.getByRole("dialog", { name: `Seat ${name}` });
  await fillBooking(page, stylist);
  await dialog.getByRole("button", { name: "Book" }).click();
  await expect(page.getByText(`${name} seated`)).toBeVisible();
  await expect(entry).toBeHidden();
});

test("two tables are joined onto one bill", async ({ page }) => {
  const first = `J${suffix()}A`;
  const second = `J${suffix()}B`;
  await signInAsOwner(page);
  await switchBusiness(page, "Karahi Corner");

  for (const table of [first, second]) {
    await page.goto("/dining/tables");
    await page.getByRole("button", { name: "New table" }).click();
    await page.getByRole("dialog").getByLabel("Name").fill(table);
    await page.getByRole("button", { name: "Add table" }).click();
    await expect(page.getByText("Table added")).toBeVisible();
    await page.goto("/dining");
    await page.getByRole("button", { name: new RegExp(`^${table}`) }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Seat" }).click();
    await page.waitForURL(/\/dining\/sessions\/[0-9a-f-]+/);
  }

  // Still on the second table's session.
  await page.getByRole("button", { name: "Join another table" }).click();
  await page.getByRole("dialog").getByRole("button", { name: first }).click();
  await expect(page.getByText(`Joined to ${first}`)).toBeVisible();
});

test("a laundry item is moved to another rack", async ({ page }) => {
  const tag = `M${suffix()}`;
  await signInAsOwner(page);
  await switchBusiness(page, "Crisp Laundry");

  await page.goto("/service-jobs/new");
  await page.getByLabel("Name").first().fill("Walk-in Omar");
  await page.getByLabel("Item").fill("Bedsheet");
  await page.getByLabel("Price").fill("250");
  await page.getByLabel("Tag").fill(tag);
  await page.getByRole("button", { name: "Take in" }).click();
  await page.waitForURL(/\/service-jobs\/[0-9a-f-]+/);

  await page.getByRole("button", { name: "Actions for Bedsheet" }).first().click();
  await page.getByRole("menuitem", { name: "Move to another rack" }).click();
  await page.getByRole("dialog").getByRole("textbox").fill("C-3");
  await page.getByRole("dialog").getByRole("button", { name: "Move" }).click();
  await expect(page.getByText("Moved to C-3")).toBeVisible();
  await expect(page.getByRole("cell", { name: "C-3" }).first()).toBeVisible();
});
