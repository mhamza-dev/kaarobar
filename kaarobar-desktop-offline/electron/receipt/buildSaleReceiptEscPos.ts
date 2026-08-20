import { currencyPrefix } from '../../shared/currencies'
import { CHARS_PER_LINE, EscPosBuilder } from './escpos'
import {
  formatPrintDate,
  getPrintLanguage,
  getSalePrintLabels,
  type PrintLanguage,
} from './printLocale'
import type { ReceiptSaleInput } from './buildSaleReceiptHtml'

/**
 * Sale receipt as ESC/POS bytes.
 *
 * Mirrors the layout of the HTML receipt (buildSaleReceiptHtml) section for
 * section, so both transports produce the same document. This is the transport
 * that works on a raw/passthrough queue — anything rendered arrives at such a
 * printer as PostScript source and gets printed literally.
 */
export function buildSaleReceiptEscPos(
  input: ReceiptSaleInput,
  paperWidth: string,
  language: PrintLanguage = input.language ?? getPrintLanguage(),
): Buffer {
  const labels = getSalePrintLabels(language)
  const currency = currencyPrefix(input.currency)
  const width = CHARS_PER_LINE[paperWidth] ?? 48
  const change = Math.max(0, input.amountPaid - input.total)
  const money = (n: number) => `${currency} ${n.toFixed(2)}`

  // Same selection rule as the HTML receipt.
  const hasCredit = input.payments.some((p) => p.method === 'credit')
  const hasCash = input.payments.some((p) => p.method === 'cash')
  const hasCard = input.payments.some((p) => p.method === 'card')
  const title =
    hasCredit && !hasCash
      ? labels.creditReceipt
      : hasCard && !hasCash && !hasCredit
        ? labels.cardReceipt
        : labels.cashReceipt

  const b = new EscPosBuilder(width).init()
  const divider = () => b.align('center').line('*'.repeat(width))

  // --- header ---
  b.align('center').bold(true).size(1, 1).line(input.businessName).size(0, 0).bold(false)
  if (input.branchAddress) b.line(input.branchAddress)
  if (input.branchPhone) b.line(`${labels.tel}: ${input.branchPhone}`)
  if (input.receiptHeader?.trim()) b.line(input.receiptHeader.trim())

  divider()
  b.align('center').bold(true).line(title).bold(false)
  divider()

  // --- meta ---
  b.align('left')
  b.pair(labels.invoice, input.invoiceNo)
  b.pair(labels.date, formatPrintDate(input.createdAt, language))
  if (input.customerName) b.pair(labels.customer, input.customerName)
  if (input.cashierName) b.pair(labels.cashier, input.cashierName)
  if (input.printedByName) b.pair(labels.printedBy, input.printedByName)

  divider()

  // --- items ---
  b.align('left').bold(true).pair(labels.description, labels.price).bold(false)
  for (const item of input.items) {
    const amount = money(item.lineTotal)
    const desc = `${item.productName} x ${item.qty}`
    // Wrap long names instead of letting the amount fall off a 32-char roll.
    const room = width - amount.length - 1
    if (desc.length <= room) {
      b.pair(desc, amount)
    } else {
      b.line(desc.slice(0, width))
      b.pair('', amount)
    }
  }

  divider()

  // --- totals ---
  b.align('left')
  if (input.discount > 0) {
    b.pair(labels.subtotal, money(input.subtotal))
    b.pair(labels.discount, `- ${money(input.discount)}`)
  }
  b.bold(true).pair(labels.total, money(input.total)).bold(false)
  for (const payment of input.payments) {
    b.pair(paymentLabel(payment.method, labels), money(payment.amount))
  }
  if (change > 0) b.pair(labels.change, money(change))

  divider()

  // --- footer ---
  b.align('center')
  b.bold(true).line(input.receiptFooter?.trim() || labels.thankYou).bold(false)
  for (const line of wrap(labels.customSoftwareSupport, width)) b.line(line)

  b.barcode(input.invoiceNo)
  b.line(`${labels.poweredBy} Kaarobar`)

  return b.cut().build()
}

/** Greedy word wrap so the support line does not overflow the roll. */
function wrap(value: string, width: number): string[] {
  const words = value.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (!current) current = word
    else if (current.length + 1 + word.length <= width) current += ` ${word}`
    else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

function paymentLabel(
  method: string,
  labels: ReturnType<typeof getSalePrintLabels>,
): string {
  if (method === 'card') return labels.card
  if (method === 'cash') return labels.cash
  if (method === 'credit') return labels.credit
  return method
}
