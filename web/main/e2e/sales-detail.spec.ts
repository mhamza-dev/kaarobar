import { expect, test, type Page } from "@playwright/test";

import { seriousA11yViolations } from "./support/a11y";
import { apiAs } from "./support/api";
import { signInAsOwner } from "./support/session";

/**
 * A3's gate: a sale is refunded from its own page (asked and approved in
 * one step by someone holding both permissions), a refund request moves
 * through the approval queue, and a shift opens into its own page with its
 * cash movements and a reconciliation that agrees.
 *
 * Each run rings a fresh sale through the API on the seed's open shift, so
 * refunds never run out of refundable stock.
 */

async function ringSale(page: Page) {
  const api = await apiAs(page);
  const [register] = await api.get("/registers");
  const [product] = await api.get("/products", { q: "Cooking oil 1L" });
  const lines = [{ variant_id: product.variants[0].id, quantity: "2" }];
  const quote = await api.post("/sales/quote", { branch_id: register.branch_id, lines });
  const total = quote.totals.total;
  const sale = await api.post("/sales", {
    register_id: register.id,
    branch_id: register.branch_id,
    lines,
    payments: [{ method: "cash", amount: total, tendered_amount: total }],
  });
  return { api, sale };
}

test("a sale is refunded from its page and the return is listed", async ({ page }) => {
  await signInAsOwner(page);
  const { sale } = await ringSale(page);

  await page.goto(`/sales/${sale.id}`);
  await page.getByRole("button", { name: "Refund items" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quantity of Cooking oil 1L to return").fill("1");
  await dialog.getByLabel("Reason").fill("Leaking bottle");
  await dialog.getByRole("button", { name: "Refund now" }).click();
  await expect(page.getByText(/^Refunded /)).toBeVisible();

  // The return shows under the sale, and in the Returns tab of all sales.
  await expect(page.getByRole("cell", { name: "Leaking bottle" }).first()).toBeVisible();
  expect(await seriousA11yViolations(page, "sale detail")).toEqual([]);

  await page.goto("/sales");
  await page.getByRole("tab", { name: "Returns" }).click();
  await expect(page.getByRole("link", { name: sale.number }).first()).toBeVisible();
});

test("a refund request is rejected with a note, another approved and paid", async ({ page }) => {
  await signInAsOwner(page);
  const { api, sale } = await ringSale(page);
  const item = sale.items[0];
  const ask = (reason: string) =>
    api.post(`/sales/${sale.id}/refund-requests`, {
      reason,
      items: [{ sale_item_id: item.id, quantity: "1", restock: true }],
    });
  const turnedDown = await ask("Changed their mind");
  const allowed = await ask("Wrong size");

  await page.goto("/refund-requests");

  // Rejecting needs a note — the backend refuses one without.
  await page.getByRole("row").filter({ hasText: turnedDown.number }).click();
  // exact: the reject dialog's title ("Reject RR-…?") contains the number too.
  let sheet = page.getByRole("dialog", { name: turnedDown.number, exact: true });
  await sheet.getByRole("button", { name: "Reject" }).click();
  await page.getByRole("dialog", { name: /Reject/ }).getByRole("textbox").fill("Opened and used");
  await page.getByRole("dialog", { name: /Reject/ }).getByRole("button", { name: "Reject" }).click();
  await expect(sheet.getByText("Opened and used")).toBeVisible();
  await sheet.getByRole("button", { name: "Close" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("row").filter({ hasText: allowed.number }).click();
  sheet = page.getByRole("dialog", { name: allowed.number, exact: true });
  await expect(sheet.getByText("Cooking oil 1L")).toBeVisible();
  await sheet.getByRole("button", { name: "Approve" }).click();
  await sheet.getByRole("button", { name: "Pay out refund" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Pay out" }).click();
  await expect(page.getByText("Refund paid out")).toBeVisible();
  await expect(sheet.getByText("Completed")).toBeVisible();
});

test("an open shift's page records cash movements and reconciles", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/shifts");
  // The open shift's row — "Opened" in the header would match a looser filter.
  await page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Open", exact: true }) })
    .first()
    .click();
  await page.waitForURL(/\/shifts\/[0-9a-f-]+$/);

  await expect(page.getByText("Cash expected now")).toBeVisible();

  await page.getByRole("button", { name: "Cash in / out" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount").fill("150");
  await dialog.getByLabel("What for").fill("Tea for the staff");
  await dialog.getByRole("button", { name: "Record" }).click();
  await expect(page.getByRole("cell", { name: "Tea for the staff" }).first()).toBeVisible();

  await page.getByRole("button", { name: "Check the figures" }).click();
  await expect(page.getByText("They agree")).toBeVisible();
  expect(await seriousA11yViolations(page, "shift detail")).toEqual([]);
});
