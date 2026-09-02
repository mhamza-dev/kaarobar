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
  withArabicScript,
  type PrintLanguage,
} from "./printLocale";
import { currencyPrefix } from "../../shared/currencies";
import {
  isRollPaper,
  type PosPaperWidth,
  type PosReceiptTemplate,
} from "./posPrinterSettings";
import {
  htmlTemplateStyle,
  PRINT_PAGE_RESET_CSS,
  type HtmlTemplateStyle,
} from "./receiptTemplates";

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

export type ReceiptLayoutOptions = {
  /** Paper the document is laid out for. Defaults to the classic 80mm roll. */
  paper?: PosPaperWidth;
  /** Visual template (see receiptTemplates.ts). Defaults to `classic`. */
  template?: PosReceiptTemplate;
  /**
   * Append a script that posts the rendered document height to the parent
   * window. Only wanted when the document is embedded as a settings preview.
   */
  reportHeightToParent?: boolean;
};

/**
 * Printable content width per roll size, in mm. Slightly narrower than the
 * paper itself because every thermal mechanism reserves an unprintable margin
 * (58mm paper prints ~48mm, 80mm paper prints ~72mm). CSS mm units let the
 * driver print at physical scale instead of guessing from a px width.
 */
/** Body width of the A4/Letter layout, matching the `max-width` in its CSS. */
const SHEET_CONTENT_MM = 180;

const ROLL_CONTENT_MM: Record<string, number> = {
  "58mm": 48,
  "76mm": 64,
  "80mm": 72,
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    <div class="social-title">${escapeHtml(followUsLabel)}</div>
    <div class="social-row">${cells.join("")}</div>
  `;
}

export async function buildSaleReceiptHtml(
  input: ReceiptSaleInput,
  options: ReceiptLayoutOptions = {},
): Promise<string> {
  const paper = options.paper ?? "80mm";
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

  const change = Math.max(0, input.amountPaid - input.total);
  const socialHtml = await socialBlock(input, labels.followUs);
  const brandHex = resolvePrintBrandHex(input.brandColor);
  const brandMark = kaarobarMarkDataUrl(brandHex);
  const invoiceJs = JSON.stringify(input.invoiceNo);
  const jsBarcodeSrc = input.jsBarcodeScript;
  const dateLabel = formatPrintDate(input.createdAt, lang);

  const style = htmlTemplateStyle(options.template ?? "classic");
  // Template font overrides are LTR-only; RTL keeps the Arabic-capable stack.
  // The override still gets the Arabic faces spliced in: the templates pick
  // Latin display faces (Courier New, Georgia, Cambria) that carry no Urdu, and
  // an English-language receipt is exactly where an Urdu product name turns up.
  const fontFamily =
    chrome.dir === "ltr" && style.fontFamilyLtr
      ? withArabicScript(style.fontFamilyLtr)
      : chrome.fontFamily;
  const heightReporter = options.reportHeightToParent
    ? `<script>window.addEventListener("load", function () { try { parent.postMessage({ __kaarobarPreviewHeight: document.documentElement.scrollHeight }, "*"); } catch (e) {} });</script>`
    : "";

  const shared = {
    labels,
    chrome,
    currency,
    title,
    paymentMethodLabel,
    logoHtml,
    contactBits,
    change,
    socialHtml,
    brandHex,
    brandMark,
    invoiceJs,
    jsBarcodeSrc,
    dateLabel,
    style,
    fontFamily,
    heightReporter,
  };

  return isRollPaper(paper)
    ? rollDocument(input, shared, ROLL_CONTENT_MM[paper] ?? 72)
    : sheetDocument(input, shared);
}

type SharedParts = {
  labels: ReturnType<typeof getSalePrintLabels>;
  chrome: ReturnType<typeof printDocumentChrome>;
  currency: string;
  title: string;
  paymentMethodLabel: (method: string) => string;
  logoHtml: string;
  contactBits: string[];
  change: number;
  socialHtml: string;
  brandHex: string;
  brandMark: string;
  invoiceJs: string;
  jsBarcodeSrc: string;
  dateLabel: string;
  style: HtmlTemplateStyle;
  fontFamily: string;
  heightReporter: string;
};

/* -------------------------------------------------------------------------- */
/* Roll layout — thermal receipt printers (58/76/80mm)                         */
/* -------------------------------------------------------------------------- */

function rollDocument(
  input: ReceiptSaleInput,
  s: SharedParts,
  contentMm: number,
): string {
  const {
    labels,
    chrome,
    currency,
    title,
    paymentMethodLabel,
    logoHtml,
    contactBits,
    change,
    socialHtml,
    brandHex,
    brandMark,
    invoiceJs,
    jsBarcodeSrc,
    dateLabel,
    style,
    fontFamily,
    heightReporter,
  } = s;

  const cssCtx = { dir: chrome.dir, brandHex, contentMm };
  const divider = style.rollDividerHtml(cssCtx);
  // Label/value row; the dotted template fills the gap with a leader element.
  const leader = style.dotLeaders ? '<span class="leader"></span>' : "";
  const row = (label: string, value: string, cls = ""): string =>
    `<div class="row${cls ? ` ${cls}` : ""}"><span>${label}</span>${leader}<span>${value}</span></div>`;

  // Item rows carry plain numbers; the currency prefix would eat too much of a
  // 58mm roll printed twice per row, and the totals block states it anyway.
  const itemRows = input.items
    .map(
      (item) => `
      <tr>
        <td class="desc">${escapeHtml(item.productName)}</td>
        <td class="price">${item.unitPrice.toFixed(2)}</td>
        <td class="qty">${item.qty}</td>
        <td class="price">${item.lineTotal.toFixed(2)}</td>
      </tr>`,
    )
    .join("");

  const paymentRows = input.payments
    .map((p) =>
      row(
        escapeHtml(paymentMethodLabel(p.method)),
        `${currency} ${p.amount.toFixed(2)}`,
      ),
    )
    .join("");

  const totalRow = row(
    escapeHtml(labels.total),
    `${currency} ${input.total.toFixed(2)}`,
    "total",
  );
  const totalBlock = style.boxedTotal
    ? `<div class="total-box">${totalRow}</div>`
    : totalRow;

  // The bold template puts the shop name and contact lines on a filled band.
  // The logo stays outside — a dark logo would vanish on the dark fill.
  const headerCore = `
      <p class="shop">${escapeHtml(input.businessName)}</p>
      ${contactBits.map((line) => `<p class="muted">${line}</p>`).join("")}`;
  const headerBlock = style.bannerHeader
    ? `<div class="band">${headerCore}</div>`
    : headerCore;

  return `<!DOCTYPE html>
<html lang="${chrome.lang}" dir="${chrome.dir}">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    ${PRINT_PAGE_RESET_CSS}
    body {
      margin: 0;
      padding: 2mm;
      font-family: ${fontFamily};
      color: #111;
      background: #fff;
      width: ${contentMm}mm;
    }
    .wrap { width: 100%; }
    .center { text-align: center; }
    .logo { max-height: 56px; max-width: 80%; display: block; margin: 0 auto 6px; }
    .shop { font-size: 16px; font-weight: 700; margin: 0; letter-spacing: 0.5px; }
    .muted { font-size: 11px; margin: 2px 0; }
    .title { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin: 10px 0; }
    .stars { text-align: center; font-size: 11px; letter-spacing: 1px; margin: 10px 0; overflow: hidden; white-space: nowrap; }
    table { width: 100%; border-collapse: collapse; font-size: 11px; }
    th { font-weight: 700; padding: 2px 0 6px; }
    th.desc, td.desc { text-align: start; }
    th.qty, td.qty { text-align: center; white-space: nowrap; padding-inline: 2px; }
    th.price, td.price { text-align: end; white-space: nowrap; }
    td { padding: 4px 0; vertical-align: top; }
    .row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; margin: 3px 0; }
    .total { font-size: 14px; font-weight: 700; margin-top: 7px; }
    .thanks { font-size: 13px; font-weight: 700; letter-spacing: 0.5px; margin: 12px 0 8px; }
    .social-title { text-align: center; font-size: 11px; margin-bottom: 6px; }
    .social-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
    .social-item { width: 72px; text-align: center; }
    .social-icon { width: 14px; height: 14px; display: block; margin: 0 auto 2px; }
    .social-qr { width: 64px; height: 64px; display: block; margin: 0 auto; }
    .social-label { font-size: 9px; margin-top: 2px; }
    #barcode { margin: 10px auto 0; display: block; max-width: 100%; }
    .brand { margin-top: 12px; padding-top: 4px; }
    .brand img { width: 28px; height: 28px; display: block; margin: 0 auto 4px; }
    .brand-name { font-size: 11px; font-weight: 700; color: ${brandHex}; }
    .support-line { font-size: 9px; color: #444; margin-top: 8px; line-height: 1.4; }
    ${style.rollCss(cssCtx)}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="center">
      ${logoHtml}
      ${headerBlock}
      ${
        input.receiptHeader?.trim()
          ? `<p class="muted" style="margin-top:6px;white-space:pre-wrap">${escapeHtml(input.receiptHeader.trim())}</p>`
          : ""
      }
    </div>
    ${divider}
    <div class="center title">${escapeHtml(title)}</div>
    ${divider}
    ${row(escapeHtml(labels.invoice), escapeHtml(input.invoiceNo))}
    ${row(escapeHtml(labels.date), escapeHtml(dateLabel))}
    ${input.customerName ? row(escapeHtml(labels.customer), escapeHtml(input.customerName)) : ""}
    ${input.cashierName ? row(escapeHtml(labels.cashier), escapeHtml(input.cashierName)) : ""}
    ${input.printedByName ? row(escapeHtml(labels.printedBy), escapeHtml(input.printedByName)) : ""}
    ${divider}
    <table>
      <thead>
        <tr>
          <th class="desc">${escapeHtml(labels.description)}</th>
          <th class="price">${escapeHtml(labels.price)}</th>
          <th class="qty">${escapeHtml(labels.qty)}</th>
          <th class="price">${escapeHtml(labels.total)}</th>
        </tr>
      </thead>
      <tbody>${itemRows}</tbody>
    </table>
    ${divider}
    ${row(escapeHtml(labels.subtotal), `${currency} ${input.subtotal.toFixed(2)}`)}
    ${row(
      escapeHtml(labels.discount),
      input.discount > 0
        ? `- ${currency} ${input.discount.toFixed(2)}`
        : `${currency} 0.00`,
    )}
    ${totalBlock}
    ${paymentRows}
    ${change > 0 ? row(escapeHtml(labels.change), `${currency} ${change.toFixed(2)}`) : ""}
    ${socialHtml ? `${divider}${socialHtml}` : ""}
    ${divider}
    ${
      input.receiptFooter?.trim()
        ? `<div class="center thanks" style="white-space:pre-wrap">${escapeHtml(input.receiptFooter.trim())}</div>`
        : ""
    }
    <svg id="barcode"></svg>
    <div class="center support-line">${escapeHtml(labels.customSoftwareSupport)}</div>
    <div class="center brand">
      <img src="${brandMark}" alt="Kaarobar" />
      <div class="brand-name">Kaarobar</div>
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
  ${heightReporter}
</body>
</html>`;
}

/* -------------------------------------------------------------------------- */
/* Sheet layout — ordinary ink/laser printers (A4 / Letter)                    */
/* -------------------------------------------------------------------------- */

/**
 * The same receipt as a full-page document. An 80mm strip printed in the
 * corner of an A4 page reads as a mistake; office printers get an invoice-like
 * layout that uses the page: header row with the logo and shop details, a
 * proper items table with quantities and unit prices, and a totals block.
 */
function sheetDocument(input: ReceiptSaleInput, s: SharedParts): string {
  const {
    labels,
    chrome,
    currency,
    title,
    paymentMethodLabel,
    logoHtml,
    contactBits,
    change,
    socialHtml,
    brandHex,
    brandMark,
    invoiceJs,
    jsBarcodeSrc,
    dateLabel,
    style,
    fontFamily,
    heightReporter,
  } = s;

  const money = (n: number) => `${currency} ${n.toFixed(2)}`;

  const itemRows = input.items
    .map(
      (item, index) => `
      <tr>
        <td class="num">${index + 1}</td>
        <td class="desc">${escapeHtml(item.productName)}</td>
        <td class="qty">${item.qty}</td>
        <td class="price">${money(item.unitPrice)}</td>
        <td class="price">${money(item.lineTotal)}</td>
      </tr>`,
    )
    .join("");

  const metaRows = [
    [labels.invoice, input.invoiceNo],
    [labels.date, dateLabel],
    input.customerName ? [labels.customer, input.customerName] : null,
    input.cashierName ? [labels.cashier, input.cashierName] : null,
    input.printedByName ? [labels.printedBy, input.printedByName] : null,
  ]
    .filter((row): row is [string, string] => row !== null)
    .map(
      ([label, value]) =>
        `<div class="meta-row"><span class="meta-label">${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`,
    )
    .join("");

  const totalRows = [
    `<div class="sum-row"><span>${escapeHtml(labels.subtotal)}</span><span>${money(input.subtotal)}</span></div>
     <div class="sum-row"><span>${escapeHtml(labels.discount)}</span><span>${input.discount > 0 ? `- ${money(input.discount)}` : money(0)}</span></div>`,
    `<div class="sum-row grand"><span>${escapeHtml(labels.total)}</span><span>${money(input.total)}</span></div>`,
    input.payments
      .map(
        (p) =>
          `<div class="sum-row"><span>${escapeHtml(paymentMethodLabel(p.method))}</span><span>${money(p.amount)}</span></div>`,
      )
      .join(""),
    change > 0
      ? `<div class="sum-row"><span>${escapeHtml(labels.change)}</span><span>${money(change)}</span></div>`
      : "",
  ].join("");

  return `<!DOCTYPE html>
<html lang="${chrome.lang}" dir="${chrome.dir}">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    ${PRINT_PAGE_RESET_CSS}
    body {
      margin: 0 auto;
      padding: 12mm 10mm;
      font-family: ${fontFamily};
      color: #111;
      background: #fff;
      max-width: 180mm;
      font-size: 13px;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
      padding-bottom: 14px;
      border-bottom: 2px solid ${brandHex};
    }
    .shop-block { min-width: 0; }
    .logo { max-height: 64px; max-width: 180px; display: block; margin-bottom: 8px; }
    .shop { font-size: 22px; font-weight: 700; margin: 0 0 4px; letter-spacing: 0.3px; }
    .muted { font-size: 12px; color: #444; margin: 2px 0; }
    .doc-block { text-align: end; flex-shrink: 0; }
    .doc-title { font-size: 16px; font-weight: 700; letter-spacing: 0.6px; margin: 0 0 8px; }
    .meta-row { display: flex; justify-content: flex-end; gap: 12px; font-size: 12px; margin: 3px 0; }
    .meta-label { color: #666; }
    .header-note { font-size: 12px; color: #444; margin: 10px 0 0; white-space: pre-wrap; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th { text-align: start; font-weight: 700; padding: 8px 10px; background: #f3f4f6; border-bottom: 2px solid #d1d5db; }
    td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    th.num, td.num { width: 34px; color: #666; }
    th.qty, td.qty { width: 60px; text-align: center; }
    th.price, td.price { width: 110px; text-align: end; white-space: nowrap; }
    .sums { display: flex; justify-content: flex-end; margin-top: 12px; }
    .sums-inner { width: 260px; }
    .sum-row { display: flex; justify-content: space-between; gap: 12px; padding: 4px 10px; font-size: 13px; }
    .sum-row.grand { font-size: 16px; font-weight: 700; border-top: 2px solid #d1d5db; border-bottom: 2px solid #d1d5db; padding: 8px 10px; margin: 4px 0; }
    .thanks { text-align: center; font-size: 15px; font-weight: 700; margin: 28px 0 6px; white-space: pre-wrap; }
    .support-line { text-align: center; font-size: 10px; color: #555; margin-top: 8px; }
    .social-title { text-align: center; font-size: 12px; margin: 18px 0 8px; }
    .social-row { display: flex; flex-wrap: wrap; justify-content: center; gap: 16px; }
    .social-item { width: 76px; text-align: center; }
    .social-icon { width: 14px; height: 14px; display: block; margin: 0 auto 2px; }
    .social-qr { width: 64px; height: 64px; display: block; margin: 0 auto; }
    .social-label { font-size: 9px; margin-top: 2px; }
    #barcode { margin: 20px auto 0; display: block; max-width: 100%; }
    .brand { margin-top: 20px; text-align: center; }
    .brand img { width: 26px; height: 26px; display: block; margin: 0 auto 4px; }
    .brand-name { font-size: 11px; font-weight: 700; color: ${brandHex}; }
    ${style.sheetCss({ dir: chrome.dir, brandHex, contentMm: SHEET_CONTENT_MM })}
  </style>
</head>
<body>
  <div class="head${style.bannerHeader ? " head-band" : ""}">
    <div class="shop-block">
      ${logoHtml}
      <p class="shop">${escapeHtml(input.businessName)}</p>
      ${contactBits.map((line) => `<p class="muted">${line}</p>`).join("")}
    </div>
    <div class="doc-block">
      <p class="doc-title">${escapeHtml(title)}</p>
      ${metaRows}
    </div>
  </div>
  ${
    input.receiptHeader?.trim()
      ? `<p class="header-note">${escapeHtml(input.receiptHeader.trim())}</p>`
      : ""
  }
  <table>
    <thead>
      <tr>
        <th class="num">#</th>
        <th class="desc">${escapeHtml(labels.description)}</th>
        <th class="qty">×</th>
        <th class="price">${escapeHtml(labels.price)}</th>
        <th class="price">${escapeHtml(labels.total)}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="sums"><div class="sums-inner">${totalRows}</div></div>
  ${socialHtml}
  ${
    input.receiptFooter?.trim()
      ? `<div class="thanks">${escapeHtml(input.receiptFooter.trim())}</div>`
      : ""
  }
  <svg id="barcode"></svg>
  <div class="support-line">${escapeHtml(labels.customSoftwareSupport)}</div>
  <div class="brand">
    <img src="${brandMark}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
  </div>
  <script>${jsBarcodeSrc}</script>
  <script>
    try {
      JsBarcode("#barcode", ${invoiceJs}, {
        format: "CODE128",
        width: 1.6,
        height: 44,
        displayValue: true,
        fontSize: 12,
        margin: 0
      });
    } catch (e) {}
  </script>
  ${heightReporter}
</body>
</html>`;
}
