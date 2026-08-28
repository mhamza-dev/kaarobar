import fs from 'node:fs'
import path from 'node:path'
import { resolveAssetAbsolutePath } from '../assets/service'
import { kaarobarMarkDataUrl, resolvePrintBrandHex } from './kaarobarMark'
import {
  getPoPrintLabels,
  getPrintLanguage,
  printDocumentChrome,
  type PrintLanguage,
} from './printLocale'
import { currencyPrefix } from '../../shared/currencies'

export type PurchaseOrderPrintInput = {
  businessName: string
  currency: string
  brandColor?: string | null
  logoPath: string | null
  supplierName: string
  supplierPhone: string | null
  supplierAddress: string | null
  branchName: string
  poNumber: string
  orderDate: string
  status: string
  items: Array<{ productName: string; orderedQty: number; unitCost: number; lineTotal: number }>
  total: number
  language?: PrintLanguage
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fileToDataUrl(absolute: string): string | null {
  try {
    const buf = fs.readFileSync(absolute)
    const ext = path.extname(absolute).toLowerCase().replace('.', '') || 'png'
    const mime =
      ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'svg'
            ? 'image/svg+xml'
            : 'image/png'
    return `data:${mime};base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

export function buildPurchaseOrderHtml(input: PurchaseOrderPrintInput): string {
  const lang = input.language ?? getPrintLanguage()
  const labels = getPoPrintLabels(lang)
  const chrome = printDocumentChrome(lang)
  const currency = currencyPrefix(input.currency)
  const brandHex = resolvePrintBrandHex(input.brandColor)
  let logoHtml = ''
  if (input.logoPath) {
    try {
      const dataUrl = fileToDataUrl(resolveAssetAbsolutePath(input.logoPath))
      if (dataUrl) logoHtml = `<img class="logo" src="${dataUrl}" alt="" />`
    } catch {
      logoHtml = ''
    }
  }

  const itemRows = input.items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.productName)}</td>
        <td class="num">${item.orderedQty}</td>
        <td class="num">${currency} ${item.unitCost.toFixed(2)}</td>
        <td class="num">${currency} ${item.lineTotal.toFixed(2)}</td>
      </tr>`,
    )
    .join('')

  const brandMark = kaarobarMarkDataUrl(brandHex)

  return `<!DOCTYPE html>
<html lang="${chrome.lang}" dir="${chrome.dir}">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: ${chrome.fontFamily};
      color: #111;
      background: #fff;
      max-width: 720px;
    }
    .center { text-align: center; }
    .logo { max-height: 56px; max-width: 160px; display: block; margin: 0 auto 8px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 14px; letter-spacing: 0.5px; margin: 16px 0 8px; }
    .muted { font-size: 12px; color: #333; margin: 2px 0; }
    .meta { margin: 12px 0; font-size: 12px; }
    .meta div { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th, td { border-bottom: 1px solid #ccc; padding: 6px 4px; text-align: start; }
    th.num, td.num { text-align: end; white-space: nowrap; }
    .total { font-size: 14px; font-weight: 700; margin-top: 12px; display: flex; justify-content: space-between; gap: 8px; }
    .brand { margin-top: 28px; text-align: center; }
    .brand img { width: 28px; height: 28px; display: block; margin: 0 auto 4px; }
    .brand-name { font-size: 11px; font-weight: 700; color: ${brandHex}; }
    .brand-tag { font-size: 9px; color: #555; }
  </style>
</head>
<body>
  <div class="center">
    ${logoHtml}
    <h1>${escapeHtml(input.businessName)}</h1>
    <p class="muted">${escapeHtml(input.branchName)}</p>
  </div>
  <h2 class="center">${escapeHtml(labels.purchaseOrder)}</h2>
  <div class="meta">
    <div><span>${escapeHtml(labels.poNumber)}</span><span>${escapeHtml(input.poNumber)}</span></div>
    <div><span>${escapeHtml(labels.date)}</span><span>${escapeHtml(input.orderDate)}</span></div>
    <div><span>${escapeHtml(labels.status)}</span><span>${escapeHtml(input.status)}</span></div>
  </div>
  <div class="meta">
    <div><span>${escapeHtml(labels.supplier)}</span><span>${escapeHtml(input.supplierName)}</span></div>
    ${input.supplierPhone ? `<div><span>${escapeHtml(labels.phone)}</span><span>${escapeHtml(input.supplierPhone)}</span></div>` : ''}
    ${input.supplierAddress ? `<div><span>${escapeHtml(labels.address)}</span><span>${escapeHtml(input.supplierAddress)}</span></div>` : ''}
  </div>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(labels.product)}</th>
        <th class="num">${escapeHtml(labels.qty)}</th>
        <th class="num">${escapeHtml(labels.unitCost)}</th>
        <th class="num">${escapeHtml(labels.total)}</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
  <div class="total"><span>${escapeHtml(labels.total)}</span><span>${currency} ${input.total.toFixed(2)}</span></div>
  <div class="brand">
    <img src="${brandMark}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
    <div class="brand-tag">${escapeHtml(labels.poweredBy)}</div>
  </div>
</body>
</html>`
}
