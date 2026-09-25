import { expect, test } from "@playwright/test";

import { seriousA11yViolations } from "./support/a11y";
import { signInAsOwner } from "./support/session";

/**
 * B3's gate: a bank account and a category are set up, an expense paid
 * from the account moves its balance, and one sent for approval is
 * approved from its page and then deleted.
 */

const suffix = () => Date.now().toString().slice(-5);

test("expenses are recorded, approved and paid from a bank account", async ({ page }) => {
  const account = `E2E current ${suffix()}`;
  const category = `E2E Utilities ${suffix()}`;
  await signInAsOwner(page);

  await page.goto("/settings/bank-accounts");
  await page.getByRole("button", { name: "New account" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(account);
  await dialog.getByLabel("Opening balance").fill("50000");
  await dialog.getByRole("button", { name: "Add account" }).click();
  const accountRow = page.getByRole("row").filter({ hasText: account });
  await expect(accountRow.getByText(/Rs\s50,000/)).toBeVisible();

  await page.goto("/expenses");
  await page.getByRole("tab", { name: "Categories" }).click();
  await page.getByLabel("New category").fill(category);
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("cell", { name: category })).toBeVisible();

  // Paid from the account: it comes off the balance.
  await page.getByRole("button", { name: "Record expense" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("What for").fill("Electricity bill");
  await dialog.getByLabel("Category").click();
  await page.getByRole("option", { name: category }).click();
  await dialog.getByLabel("Amount").fill("7500.50");
  await dialog.getByLabel("Paid by").click();
  await page.getByRole("option", { name: "Bank" }).click();
  await dialog.getByLabel("From account").click();
  await page.getByRole("option", { name: account }).click();
  await dialog.getByRole("button", { name: "Record" }).click();
  await page.waitForURL(/\/expenses\/[0-9a-f-]+$/);
  await expect(page.getByText(/Rs\s7,500\.50/).first()).toBeVisible();
  expect(await seriousA11yViolations(page, "expense page")).toEqual([]);

  await page.goto("/settings/bank-accounts");
  await expect(accountRow.getByText(/Rs\s42,499\.50/)).toBeVisible();

  // One that waits for approval.
  await page.goto("/expenses");
  await page.getByRole("button", { name: "Record expense" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("What for").fill("New kettle");
  await dialog.getByLabel("Category").click();
  await page.getByRole("option", { name: category }).click();
  await dialog.getByLabel("Amount").fill("3200");
  await dialog.getByRole("checkbox", { name: "Send for approval" }).click();
  await dialog.getByRole("button", { name: "Record" }).click();
  await page.waitForURL(/\/expenses\/[0-9a-f-]+$/);
  await expect(page.getByText("Pending")).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete expense" }).click();
  await page.waitForURL(/\/expenses$/);
});
