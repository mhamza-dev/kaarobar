import fs from 'node:fs'
import type { PosPrintData } from 'electron-pos-printer'
import { resolveAssetAbsolutePath } from '../assets/service'
import { currencyPrefix } from '../../shared/currencies'
import {
  formatPrintDate,
  getPrintLanguage,
  getSalePrintLabels,
  type PrintLanguage,
} from './printLocale'
import type { ReceiptSaleInput } from './buildSaleReceiptHtml'

/**
 * Sale receipt as structured POS rows.
 *
 * The HTML receipt is an A-series document that happens to be narrow; sending it
 * through the browser print pipeline leaves the driver to reflow it, which is how
 * a text-only/generic thermal driver ends up emitting the markup rather than the
 * rendered page. electron-pos-printer instead lays each row out at the paper
 * width, so nothing is left for the driver to interpret.
 */

type Row = PosPrintData

const MONO = '"Courier New", ui-monospace, monospace'

function money(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`
}

function line(char = '-'): Row {
  return {
    type: 'text',
    value: char.repeat(42),
    style: { fontFamily: MONO, fontSize: '11px', textAlign: 'center', margin: '2px 0' },
  }
}

function centered(value: string, opts: { bold?: boolean; size?: string } = {}): Row {
  return {
    type: 'text',
    value,
    style: {
      textAlign: 'center',
      fontWeight: opts.bold ? '700' : '400',
      fontSize: opts.size ?? '12px',
      margin: '1px 0',
    },
  }
}

/** Left label / right value on one line — the standard receipt pairing. */
function pair(label: string, value: string, opts: { bold?: boolean } = {}): Row {
  return {
    type: 'text',
    value: `<div style="display:flex;justify-content:space-between;gap:8px;">
      <span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span>
    </div>`,
    style: {
      fontSize: opts.bold ? '14px' : '12px',
      fontWeight: opts.bold ? '700' : '400',
      margin: '1px 0',
    },
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function paymentMethodLabel(
  method: string,
  labels: ReturnType<typeof getSalePrintLabels>,
): string {
  const key = method.toLowerCase()
  if (key === 'cash') return labels.cash
  if (key === 'card') return labels.card
  if (key === 'credit') return labels.credit
  return method
}

export function buildSaleReceiptPos(
  input: ReceiptSaleInput,
  language: PrintLanguage = input.language ?? getPrintLanguage(),
): Row[] {
  const labels = getSalePrintLabels(language)
  const currency = currencyPrefix(input.currency)
  const change = Math.max(input.amountPaid - input.total, 0)

  const rows: Row[] = []

  // --- header -------------------------------------------------------------
  // `logoPath` is an asset key, not a filesystem path — resolve it the same way
  // the HTML receipt does, and skip the row entirely if the file is missing so a
  // broken logo can never fail the whole print.
  const logoAbsolute = input.logoPath ? resolveAssetAbsolutePath(input.logoPath) : null
  if (logoAbsolute && fs.existsSync(logoAbsolute)) {
    rows.push({
      type: 'image',
      path: logoAbsolute,
      position: 'center',
      width: '120px',
      style: { margin: '0 auto 4px' },
    })
  }
  rows.push(centered(input.businessName, { bold: true, size: '16px' }))
  if (input.branchAddress) rows.push(centered(input.branchAddress, { size: '11px' }))
  if (input.branchPhone) {
    rows.push(centered(`${labels.tel} ${input.branchPhone}`, { size: '11px' }))
  }
  if (input.receiptHeader) rows.push(centered(input.receiptHeader, { size: '11px' }))

  rows.push(line('='))

  // --- meta ---------------------------------------------------------------
  rows.push(pair(labels.invoice, input.invoiceNo, { bold: true }))
  rows.push(pair(labels.date, formatPrintDate(input.createdAt, language)))
  if (input.customerName) rows.push(pair(labels.customer, input.customerName))
  if (input.cashierName) rows.push(pair(labels.cashier, input.cashierName))
  if (input.printedByName && input.printedByName !== input.cashierName) {
    rows.push(pair(labels.printedBy, input.printedByName))
  }

  rows.push(line())

  // --- items --------------------------------------------------------------
  rows.push({
    type: 'table',
    style: { width: '100%', fontSize: '11px' },
    tableHeader: [labels.description, labels.price],
    tableHeaderStyle: {
      borderBottom: '1px solid #000',
      fontWeight: '700',
      textAlign: 'left',
      fontSize: '11px',
    },
    tableBody: input.items.map((item) => [
      {
        type: 'text' as const,
        value: `${escapeHtml(item.productName)}<br/><span style="font-size:10px">${item.qty} x ${money(currency, item.unitPrice)}</span>`,
        style: { textAlign: 'left', paddingRight: '6px' },
      },
      {
        type: 'text' as const,
        value: money(currency, item.lineTotal),
        style: { textAlign: 'right', whiteSpace: 'nowrap' },
      },
    ]),
    tableBodyStyle: { fontSize: '11px', padding: '2px 0', verticalAlign: 'top' },
  })

  rows.push(line())

  // --- totals -------------------------------------------------------------
  if (input.discount > 0) {
    rows.push(pair(labels.subtotal, money(currency, input.subtotal)))
    rows.push(pair(labels.discount, `- ${money(currency, input.discount)}`))
  }
  rows.push(pair(labels.total, money(currency, input.total), { bold: true }))

  for (const payment of input.payments) {
    rows.push(pair(paymentMethodLabel(payment.method, labels), money(currency, payment.amount)))
  }
  if (change > 0) rows.push(pair(labels.change, money(currency, change)))

  rows.push(line('='))

  // --- barcode ------------------------------------------------------------
  // Rendered by the library rather than injected JsBarcode: no script has to run
  // inside the print surface for the invoice number to be scannable.
  rows.push({
    type: 'barCode',
    value: input.invoiceNo.replace(/[^0-9A-Za-z]/g, '').slice(0, 20) || '0',
    height: '40',
    width: '2',
    displayValue: true,
    fontsize: 10,
    position: 'center',
  })

  // --- footer -------------------------------------------------------------
  if (input.receiptFooter) rows.push(centered(input.receiptFooter, { size: '11px' }))
  rows.push(centered(labels.thankYou, { bold: true, size: '12px' }))

  const socials = [
    input.socialWhatsapp,
    input.socialInstagram,
    input.socialFacebook,
    input.socialTiktok,
    input.socialWebsite,
  ].filter((v): v is string => !!v && v.trim().length > 0)

  if (socials.length > 0) {
    rows.push(centered(labels.followUs, { size: '10px' }))
    for (const handle of socials) rows.push(centered(handle, { size: '10px' }))
  }

  rows.push(centered(labels.poweredBy + ' Kaarobar', { size: '10px' }))
  // Trailing whitespace so the cut lands clear of the last line.
  rows.push({ type: 'text', value: ' ', style: { margin: '0 0 18px' } })

  return rows
}
