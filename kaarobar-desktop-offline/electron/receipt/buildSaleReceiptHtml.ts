import fs from "node:fs";
import path from "node:path";
import QRCode from "qrcode";
import { resolveAssetAbsolutePath } from "../assets/service";
import {
  SOCIAL_LABELS,
  socialIconDataUrl,
  type SocialPlatform,
} from "./socialIcons";
import { kaarobarMarkDataUrl, resolvePrintBrandHex } from "./kaarobarMark";
import {
  formatPrintDate,
  getPrintLanguage,
  getSalePrintLabels,
  printDocumentChrome,
  type PrintLanguage,
} from "./printLocale";
import { currencyPrefix } from "../../shared/currencies";

export type ReceiptSaleInput = {
  invoiceNo: string;
  subtotal: number;
  discount: number;
  total: number;
  amountPaid: number;
  createdAt: string;
  businessName: string;
  currency: string;
  brandColor?: string | null;
  logoPath: string | null;
  customerName: string | null;
  cashierName: string | null;
  printedByName: string | null;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  branchAddress: string | null;
  branchPhone: string | null;
  socialWhatsapp: string | null;
  socialInstagram: string | null;
  socialFacebook: string | null;
  socialTiktok: string | null;
  socialWebsite: string | null;
  items: Array<{
    productName: string;
    qty: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  payments: Array<{ method: string; amount: number }>;
  jsBarcodeScript: string;
  language?: PrintLanguage;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function divider(): string {
  return `<div class="stars">********************************</div>`;
}

function fileToDataUrl(absolute: string): string | null {
  try {
    const buf = fs.readFileSync(absolute);
    const ext = path.extname(absolute).toLowerCase().replace(".", "") || "png";
    const mime =
      ext === "jpg" || ext === "jpeg"
        ? "image/jpeg"
        : ext === "webp"
          ? "image/webp"
          : ext === "gif"
            ? "image/gif"
            : ext === "svg"
              ? "image/svg+xml"
              : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

async function socialBlock(
  input: ReceiptSaleInput,
  followUsLabel: string,
): Promise<string> {
  const links: Array<{ platform: SocialPlatform; url: string }> = (
    [
      { platform: "whatsapp" as const, url: input.socialWhatsapp || "" },
      { platform: "instagram" as const, url: input.socialInstagram || "" },
      { platform: "facebook" as const, url: input.socialFacebook || "" },
      { platform: "tiktok" as const, url: input.socialTiktok || "" },
      { platform: "website" as const, url: input.socialWebsite || "" },
    ] satisfies Array<{ platform: SocialPlatform; url: string }>
  ).filter((l) => l.url.trim());

  if (links.length === 0) return "";

  const cells: string[] = [];
  for (const link of links) {
    const qr = await QRCode.toDataURL(link.url.trim(), {
      margin: 1,
      width: 72,
      color: { dark: "#000000", light: "#ffffff" },
    });
    cells.push(`
      <div class="social-item">
        <img class="social-icon" src="${socialIconDataUrl(link.platform)}" alt="" />
        <img class="social-qr" src="${qr}" alt="${SOCIAL_LABELS[link.platform]}" />
        <div class="social-label">${SOCIAL_LABELS[link.platform]}</div>
      </div>
    `);
  }

  return `
    ${divider()}
    <div class="social-title">${escapeHtml(followUsLabel)}</div>
    <div class="social-row">${cells.join("")}</div>
  `;
}

export async function buildSaleReceiptHtml(
  input: ReceiptSaleInput,
): Promise<string> {
  const lang = input.language ?? getPrintLanguage();
  const labels = getSalePrintLabels(lang);
  const chrome = printDocumentChrome(lang);
  const currency = currencyPrefix(input.currency);
  const hasCredit = input.payments.some((p) => p.method === "credit");
  const hasCash = input.payments.some((p) => p.method === "cash");
  const hasCard = input.payments.some((p) => p.method === "card");
  const title =
    hasCredit && !hasCash
      ? labels.creditReceipt
      : hasCard && !hasCash && !hasCredit
        ? labels.cardReceipt
        : labels.cashReceipt;

  const paymentMethodLabel = (method: string): string => {
    if (method === "card") return labels.card;
    if (method === "cash") return labels.cash;
    if (method === "credit") return labels.credit;
    return method;
  };

  let logoHtml = "";
  if (input.logoPath) {
    try {
      const dataUrl = fileToDataUrl(resolveAssetAbsolutePath(input.logoPath));
      if (dataUrl) {
        logoHtml = `<img class="logo" src="${dataUrl}" alt="" />`;
      }
    } catch {
      logoHtml = "";
    }
  }

  const contactBits = [
    input.branchAddress ? escapeHtml(input.branchAddress) : "",
    input.branchPhone
      ? `${escapeHtml(labels.tel)}: ${escapeHtml(input.branchPhone)}`
      : "",
  ].filter(Boolean);

  const itemRows = input.items
    .map(
      (item) => `
      <tr>
        <td class="desc">${escapeHtml(item.productName)} × ${item.qty}</td>
        <td class="price">${currency} ${item.lineTotal.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const paymentRows = input.payments
    .map(
      (p) =>
        `<div class="row"><span>${escapeHtml(paymentMethodLabel(p.method))}</span><span>${currency} ${p.amount.toFixed(2)}</span></div>`,
    )
    .join("");

  const change = Math.max(0, input.amountPaid - input.total);
  const socialHtml = await socialBlock(input, labels.followUs);
  const brandHex = resolvePrintBrandHex(input.brandColor);
  const brandMark = kaarobarMarkDataUrl(brandHex);
  const invoiceJs = JSON.stringify(input.invoiceNo);
  const jsBarcodeSrc = input.jsBarcodeScript;
  const dateLabel = formatPrintDate(input.createdAt, lang);

  return `<!DOCTYPE html>
<html lang="${chrome.lang}" dir="${chrome.dir}">
<head>
  <meta charset="utf-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="${chrome.fontLink}" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 12px;
      font-family: ${chrome.fontFamily};
      color: #111;
      background: #fff;
      width: 300px;
    }
    .wrap { width: 100%; }
    .center { text-align: center; }
    .logo { max-height: 56px; max-width: 140px; display: block; margin: 0 auto 6px; }
    .shop { font-size: 16px; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
    .muted { font-size: 11px; margin: 2px 0; }
    .title { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin: 8px 0; }
    .stars { text-align: center; font-size: 11px; letter-spacing: 1px; margin: 8px 0; overflow: hidden; white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { font-weight: 700; padding: 2px 0 6px; }
    th.desc, td.desc { text-align: start; }
    th.price, td.price { text-align: end; white-space: nowrap; }
    td { padding: 3px 0; vertical-align: top; }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; margin: 2px 0; }
    .total { font-size: 14px; font-weight: 700; margin-top: 6px; }
    .thanks { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin: 10px 0 6px; }
    .social-title { text-align: center; font-size: 11px; margin-bottom: 6px; }
    .social-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
    .social-item { width: 72px; text-align: center; }
    .social-icon { width: 14px; height: 14px; display: block; margin: 0 auto 2px; }
    .social-qr { width: 64px; height: 64px; display: block; margin: 0 auto; }
    .social-label { font-size: 9px; margin-top: 2px; }
    #barcode { margin: 8px auto 4px; display: block; max-width: 100%; }
    .brand { margin-top: 10px; padding-top: 4px; }
    .brand img { width: 28px; height: 28px; display: block; margin: 0 auto 4px; }
    .brand-name { font-size: 11px; font-weight: 700; color: ${brandHex}; }
    .brand-tag { font-size: 9px; color: #555; }
    .support-line { font-size: 9px; color: #444; margin-top: 6px; line-height: 1.4; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      ${logoHtml}
      <p class="shop">${escapeHtml(input.businessName)}</p>
      ${contactBits.map((line) => `<p class="muted">${line}</p>`).join("")}
      ${
        input.receiptHeader?.trim()
          ? `<p class="muted" style="margin-top:6px;white-space:pre-wrap">${escapeHtml(input.receiptHeader.trim())}</p>`
          : ""
      }
    </div>
    ${divider()}
    <div class="center title">${escapeHtml(title)}</div>
    ${divider()}
    <div class="row"><span>${escapeHtml(labels.invoice)}</span><span>${escapeHtml(input.invoiceNo)}</span></div>
    <div class="row"><span>${escapeHtml(labels.date)}</span><span>${escapeHtml(dateLabel)}</span></div>
    ${input.customerName ? `<div class="row"><span>${escapeHtml(labels.customer)}</span><span>${escapeHtml(input.customerName)}</span></div>` : ""}
    ${input.cashierName ? `<div class="row"><span>${escapeHtml(labels.cashier)}</span><span>${escapeHtml(input.cashierName)}</span></div>` : ""}
    ${input.printedByName ? `<div class="row"><span>${escapeHtml(labels.printedBy)}</span><span>${escapeHtml(input.printedByName)}</span></div>` : ""}
    ${divider()}
    <table>
      <thead>
        <tr>
          <th class="desc">${escapeHtml(labels.description)}</th>
          <th class="price">${escapeHtml(labels.price)}</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    ${divider()}
    ${
      input.discount > 0
        ? `<div class="row"><span>${escapeHtml(labels.subtotal)}</span><span>${currency} ${input.subtotal.toFixed(2)}</span></div>
    <div class="row"><span>${escapeHtml(labels.discount)}</span><span>- ${currency} ${input.discount.toFixed(2)}</span></div>`
        : ""
    }
    <div class="row total"><span>${escapeHtml(labels.total)}</span><span>${currency} ${input.total.toFixed(2)}</span></div>
    ${paymentRows}
    ${change > 0 ? `<div class="row"><span>${escapeHtml(labels.change)}</span><span>${currency} ${change.toFixed(2)}</span></div>` : ""}
    ${socialHtml}
    ${divider()}
    <div class="center thanks" style="white-space:pre-wrap">${escapeHtml(
      input.receiptFooter?.trim() || labels.thankYou,
    )}</div>
    <div class="center support-line">${escapeHtml(labels.customSoftwareSupport)}</div>
    <svg id="barcode"></svg>
    <div class="center brand">
      <img src="${brandMark}" alt="Kaarobar" />
      <div class="brand-name">Kaarobar</div>
      <div class="brand-tag">${escapeHtml(labels.poweredBy)}</div>
    </div>
  </div>
  <script>${jsBarcodeSrc}</script>
  <script>
    try {
      JsBarcode("#barcode", ${invoiceJs}, {
        format: "CODE128",
        width: 1.4,
        height: 40,
        displayValue: true,
        fontSize: 11,
        margin: 0
      });
    } catch (e) {}
  </script>
</body>
</html>`;
}
