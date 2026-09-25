import { expect, test } from "@playwright/test";

import { seriousA11yViolations } from "./support/a11y";
import { apiAs } from "./support/api";
import { signInAsOwner } from "./support/session";

/**
 * A4's gate: a gift card is issued (its code shown once), topped up and
 * spent; a follow-up is rescheduled and closed from its sheet; store
 * credit is given and spent; a payment on account is matched to the
 * invoice it pays.
 */

test("a gift card is issued, topped up and spent", async ({ page }) => {
  await signInAsOwner(page);
  await page.goto("/gift-cards");
  await page.getByRole("button", { name: "Issue a gift card" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Amount").fill("5000");
  await dialog.getByLabel("For").fill("Sana");
  await dialog.getByRole("button", { name: "Issue card" }).click();

  // The one time the code is visible, and the dialog won't close on its own.
  const code = (await dialog.getByLabel("Gift card code").textContent())?.trim();
  expect(code).toBeTruthy();
  await page.keyboard.press("Escape");
  await expect(dialog.getByLabel("Gift card code")).toBeVisible();
  expect(await seriousA11yViolations(page, "issued gift card")).toEqual([]);
  await dialog.getByRole("button", { name: "I've recorded the code" }).click();

  const activate = page.getByRole("button", { name: "Activate" });
  if (await activate.isVisible()) await activate.click();

  await page.getByRole("button", { name: "Top up" }).click();
  await page.getByRole("dialog").getByLabel(/Amount/).fill("1000");
  await page.getByRole("dialog").getByRole("button", { name: /^Top up/ }).click();
  await expect(page.getByText("Rs 6,000").first()).toBeVisible();

  await page.getByRole("main").getByRole("button", { name: "Spend", exact: true }).click();
  await page.getByRole("dialog").getByLabel(/Amount/).fill("2500");
  await page.getByRole("dialog").getByRole("button", { name: /^Spend/ }).click();
  await expect(page.getByText("Rs 3,500").first()).toBeVisible();

  // Looked up again later, by the code alone.
  await page.reload();
  await page.getByLabel("Card code").fill(code!);
  await page.getByRole("button", { name: "Look up" }).click();
  await expect(page.getByText("Rs 3,500").first()).toBeVisible();
});

test("a follow-up is rescheduled and closed from its sheet", async ({ page }) => {
  const title = `Call about the order ${Date.now().toString().slice(-5)}`;
  await signInAsOwner(page);
  await page.goto("/follow-ups");

  await page.getByRole("button", { name: "New follow-up" }).click();
  const create = page.getByRole("dialog");
  await create.getByLabel("Customer").click();
  await page.getByPlaceholder("Search name or phone…").fill("Hotel");
  await page.getByRole("option", { name: /Hotel Shalimar/ }).click();
  await create.getByLabel("What needs doing").fill(title);
  await create.getByRole("button", { name: "Add follow-up" }).click();

  await page.getByRole("row").filter({ hasText: title }).click();
  const sheet = page.getByRole("dialog", { name: title });
  await sheet.getByLabel("Details").fill("Ask about next month's rice order");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Follow-up updated")).toBeVisible();

  await sheet.getByRole("button", { name: "Mark done" }).click();
  await page.getByRole("dialog").last().getByRole("textbox").first().fill("Ordered 20 bags");
  await page.getByRole("dialog").last().getByRole("button", { name: /Done|Complete|Mark/ }).click();
  await expect(sheet.getByText("Ordered 20 bags")).toBeVisible();
});

test("store credit is given and spent; a payment is matched to its invoice", async ({ page }) => {
  await signInAsOwner(page);
  const api = await apiAs(page);
  const [customer] = await api.get("/customers", { q: "Hotel Shalimar" });

  // A sale on the hotel's account, and a payment against it left unmatched.
  const [register] = await api.get("/registers");
  const [product] = await api.get("/products", { q: "Sugar" });
  const lines = [{ variant_id: product.variants[0].id, quantity: "1" }];
  const quote = await api.post("/sales/quote", {
    branch_id: register.branch_id,
    customer_id: customer.id,
    lines,
  });
  const sale = await api.post("/sales", {
    register_id: register.id,
    branch_id: register.branch_id,
    customer_id: customer.id,
    lines,
    payments: [{ method: "credit", amount: quote.totals.total }],
  });
  const payment = await api.post(`/customers/${customer.id}/payments`, {
    amount: quote.totals.total,
    method: "cash",
  });

  await page.goto(`/customers/${customer.id}`);
  await page.getByRole("tab", { name: "Account" }).click();

  await page.getByRole("button", { name: "Give store credit" }).click();
  const give = page.getByRole("dialog");
  await give.getByLabel("Amount").fill("300");
  await give.getByLabel("Why").fill("Late delivery");
  await give.getByRole("button", { name: "Give credit" }).click();
  await page.getByRole("row").filter({ hasText: "Late delivery" }).first().click();
  const credit = page.getByRole("dialog", { name: /^SC/ });
  await credit.getByLabel("Spend from it").fill("100");
  await credit.getByRole("button", { name: "Spend" }).click();
  await expect(credit.getByText("Rs 200").first()).toBeVisible();
  await credit.getByRole("button", { name: "Close" }).click();

  // The statement lists the payment too; its own row is in Payments, below.
  await page.getByRole("row").filter({ hasText: payment.number }).last().click();
  const match = page.getByRole("dialog", { name: `Match ${payment.number} to invoices` });
  await match.getByLabel(`Amount towards ${sale.number}`).fill(quote.totals.total);
  await match.getByRole("button", { name: "Match", exact: true }).click();
  await expect(page.getByText(`${payment.number} matched to invoices`)).toBeVisible();
  // Paid in full, it leaves Open invoices (where it's a link); the statement
  // still mentions it, as it should.
  await expect(page.getByRole("link", { name: sale.number })).toHaveCount(0);
});
