import fs from 'node:fs'
import path from 'node:path'
import { resolveAssetAbsolutePath } from '../assets/service'
import { kaarobarMarkDataUrl, resolvePrintBrandHex } from './kaarobarMark'
import {
  formatPrintDate,
  getLedgerPrintLabels,
  getPrintLanguage,
  printDocumentChrome,
  type PrintLanguage,
} from './printLocale'
import { currencyPrefix } from '../../shared/currencies'
import { PRINT_PAGE_RESET_CSS } from "./receiptTemplates";

export type CustomerLedgerPrintEntry = {
  createdAt: string
  type: 'sale' | 'payment' | 'adjustment' | 'opening'
  amount: number
  balanceAfter: number
  note: string | null
  method: 'cash' | 'card' | null
  invoiceNo: string | null
}

export type CustomerLedgerPrintInput = {
  businessName: string
  currency: string
  brandColor?: string | null
  logoPath: string | null
  customerName: string
  customerPhone: string | null
  from: string | null
  to: string | null
  openingBalance: number
  entries: CustomerLedgerPrintEntry[]
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

function money(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`
}

function noteText(note: string | null): string {
  if (!note) return ''
  const match = note.match(/^method:(cash|card)(?:\s*\|\s*(.*))?$/i)
  if (match) return match[2]?.trim() || ''
  return note.trim()
}

function particulars(
  entry: CustomerLedgerPrintEntry,
  labels: ReturnType<typeof getLedgerPrintLabels>,
): string {
  const typeLabel =
    entry.type === 'sale'
      ? labels.sale
      : entry.type === 'payment'
        ? labels.payment
        : entry.type === 'adjustment'
          ? labels.adjustment
          : labels.opening
  const parts = [typeLabel]
  if (entry.invoiceNo) parts.push(entry.invoiceNo)
  if (entry.method === 'cash') parts.push(labels.cash)
  if (entry.method === 'card') parts.push(labels.card)
  const note = noteText(entry.note)
  if (note) parts.push(note)
  return parts.join(' · ')
}

export function buildCustomerLedgerHtml(input: CustomerLedgerPrintInput): string {
  const lang = input.language ?? getPrintLanguage()
  const labels = getLedgerPrintLabels(lang)
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

  const periodLabel =
    input.from || input.to
      ? `${input.from || '…'} → ${input.to || '…'}`
      : labels.allEntries

  let debitTotal = 0
  let creditTotal = 0
  const rows = input.entries
    .map((entry) => {
      const debit = entry.amount > 0 ? entry.amount : 0
      const credit = entry.amount < 0 ? Math.abs(entry.amount) : 0
      debitTotal += debit
      creditTotal += credit
      return `
      <tr>
        <td>${escapeHtml(formatPrintDate(entry.createdAt, lang))}</td>
        <td>${escapeHtml(particulars(entry, labels))}</td>
        <td class="num">${debit ? escapeHtml(money(currency, debit)) : ''}</td>
        <td class="num">${credit ? escapeHtml(money(currency, credit)) : ''}</td>
        <td class="num">${escapeHtml(money(currency, entry.balanceAfter))}</td>
      </tr>`
    })
    .join('')

  const closingBalance =
    input.entries.length > 0
      ? input.entries[input.entries.length - 1].balanceAfter
      : input.openingBalance

  const brandMark = kaarobarMarkDataUrl(brandHex)
  const showOpening = Boolean(input.from || input.to) || input.openingBalance !== 0

  return `<!DOCTYPE html>
<html lang="${chrome.lang}" dir="${chrome.dir}">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    ${PRINT_PAGE_RESET_CSS}
    body {
      margin: 0;
      padding: 24px;
      font-family: ${chrome.fontFamily};
      color: #111;
      background: #fff;
      max-width: 900px;
    }
    .center { text-align: center; }
    .logo { max-height: 56px; max-width: 160px; display: block; margin: 0 auto 8px; }
    h1 { font-size: 18px; margin: 0 0 4px; }
    h2 { font-size: 15px; letter-spacing: 0.6px; margin: 14px 0 8px; }
    .muted { font-size: 12px; color: #333; margin: 2px 0; }
    .meta { margin: 12px 0; font-size: 12px; }
    .meta div { display: flex; justify-content: space-between; gap: 8px; margin: 2px 0; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
      margin-top: 8px;
      border: 1px solid #222;
    }
    th, td {
      border: 1px solid #999;
      padding: 7px 6px;
      text-align: start;
      vertical-align: top;
    }
    th {
      background: #f3f3f3;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      font-size: 10.5px;
    }
    th.num, td.num { text-align: end; white-space: nowrap; font-variant-numeric: tabular-nums; }
    tr.opening td { background: #fafafa; font-style: italic; }
    tr.totals td { font-weight: 700; background: #f7f7f7; }
    .closing {
      margin-top: 12px;
      font-size: 13px;
      font-weight: 700;
      display: flex;
      justify-content: space-between;
      gap: 8px;
      border-top: 2px solid #222;
      padding-top: 8px;
    }
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
  </div>
  <h2 class="center">${escapeHtml(labels.title)}</h2>
  <div class="meta">
    <div><span>${escapeHtml(labels.customer)}</span><span>${escapeHtml(input.customerName)}</span></div>
    ${input.customerPhone ? `<div><span>${escapeHtml(labels.phone)}</span><span>${escapeHtml(input.customerPhone)}</span></div>` : ''}
    <div><span>${escapeHtml(labels.period)}</span><span>${escapeHtml(periodLabel)}</span></div>
    <div><span>${escapeHtml(labels.printedAt)}</span><span>${escapeHtml(formatPrintDate(new Date().toISOString(), lang))}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>${escapeHtml(labels.date)}</th>
        <th>${escapeHtml(labels.particulars)}</th>
        <th class="num">${escapeHtml(labels.debit)}</th>
        <th class="num">${escapeHtml(labels.credit)}</th>
        <th class="num">${escapeHtml(labels.balance)}</th>
      </tr>
    </thead>
    <tbody>
      ${
        showOpening
          ? `<tr class="opening">
        <td></td>
        <td>${escapeHtml(labels.balanceBroughtForward)}</td>
        <td class="num"></td>
        <td class="num"></td>
        <td class="num">${escapeHtml(money(currency, input.openingBalance))}</td>
      </tr>`
          : ''
      }
      ${rows}
      <tr class="totals">
        <td colspan="2">${escapeHtml(labels.totals)}</td>
        <td class="num">${escapeHtml(money(currency, debitTotal))}</td>
        <td class="num">${escapeHtml(money(currency, creditTotal))}</td>
        <td class="num"></td>
      </tr>
    </tbody>
  </table>
  <div class="closing">
    <span>${escapeHtml(labels.closingBalance)}</span>
    <span>${escapeHtml(money(currency, closingBalance))}</span>
  </div>
  <div class="brand">
    <img src="${brandMark}" alt="Kaarobar" />
    <div class="brand-name">Kaarobar</div>
    <div class="brand-tag">${escapeHtml(labels.poweredBy)}</div>
  </div>
</body>
</html>`
}
