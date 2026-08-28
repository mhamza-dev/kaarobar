import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import { resolveAssetAbsolutePath } from '../assets/service'
import { encodeImageRaster } from './escposImage'
import { currencyPrefix } from '../../shared/currencies'
import {
  DOTS_PER_CHAR,
  EDGE_MARGIN_CHARS,
  EscPosBuilder,
  isCp437Printable,
  usableChars,
} from './escpos'
import {
  formatPrintDate,
  getPrintLanguage,
  getSalePrintLabels,
  type PrintLanguage,
} from './printLocale'
import type { ReceiptSaleInput } from './buildSaleReceiptHtml'
import type { PosReceiptTemplate } from './posPrinterSettings'
import { escposTemplateStyle } from './receiptTemplates'

export type EscPosReceiptOptions = {
  language?: PrintLanguage
  template?: PosReceiptTemplate
}

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
  options: EscPosReceiptOptions = {},
): Buffer {
  const language = options.language ?? input.language ?? getPrintLanguage()
  // The selected template approximated in text: divider character, dot leaders,
  // boxed total. All ASCII, so the CP437 story below is unchanged.
  const st = escposTemplateStyle(options.template ?? 'classic')
  // Everything below is encoded as CP437, so the requested language is only
  // usable if its script survives that. See printableLanguage.
  const printLang = printableLanguage(language)
  const labels = getSalePrintLabels(printLang)
  const currency = printableCurrency(input.currency)
  // Reserve a blank column at each edge — some printers clip the first/last
  // column, which showed up as the business name losing characters.
  const width = usableChars(paperWidth)
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
  b.leftMargin(EDGE_MARGIN_CHARS * DOTS_PER_CHAR)
  b.printWidth(width * DOTS_PER_CHAR)

  // The divider style is a pattern (usually one char; `\/` for the chevron
  // template), repeated and clipped to the roll width.
  const divider = () =>
    b
      .align('center')
      .line(st.dividerChar.repeat(Math.ceil(width / st.dividerChar.length)).slice(0, width))

  // --- header ---
  // Business logo, scaled to the printable width.
  const logoDots = width * DOTS_PER_CHAR
  if (input.logoPath) {
    b.align('center').raster(
      encodeImageRaster(resolveAssetAbsolutePath(input.logoPath), Math.min(logoDots, 384)),
    )
  }

  // Double-width halves the columns available (24 on 80mm, 16 on 58mm), so only
  // use it when the name actually fits; otherwise print at normal size and wrap.
  b.align('center').bold(true)
  if (input.businessName.length <= Math.floor(width / 2)) {
    b.size(1, 1).line(input.businessName).size(0, 0)
  } else {
    for (const line of wrap(input.businessName, width)) b.line(line)
  }
  b.bold(false)

  for (const raw of headerLines(input, labels.tel)) {
    for (const line of wrap(raw, width)) b.line(line)
  }

  divider()
  b.align('center').bold(true).line(title).bold(false)
  divider()

  // --- meta ---
  b.align('left')
  b.pair(labels.invoice, input.invoiceNo, st.pairLeader)
  b.pair(labels.date, formatPrintDate(input.createdAt, printLang), st.pairLeader)
  if (input.customerName) b.pair(labels.customer, input.customerName, st.pairLeader)
  if (input.cashierName) b.pair(labels.cashier, input.cashierName, st.pairLeader)
  if (input.printedByName) b.pair(labels.printedBy, input.printedByName, st.pairLeader)

  divider()

  // --- items ---
  // Item rows carry plain numbers: the currency prefix printed twice per row
  // would eat a 58mm line, and the totals block below states the currency.
  b.align('left')
  const plain = (n: number) => n.toFixed(2)
  const priceW = Math.max(
    labels.price.length,
    ...input.items.map((i) => plain(i.unitPrice).length),
  )
  const qtyW = Math.max(labels.qty.length, ...input.items.map((i) => String(i.qty).length))
  const totalW = Math.max(
    labels.total.length,
    ...input.items.map((i) => plain(i.lineTotal).length),
  )
  const nameW = width - priceW - qtyW - totalW - 3
  // Clipping only ever hits a header label wider than the name column — item
  // names longer than the column take the wrap branch below instead.
  const itemCols = (name: string, price: string, qty: string, total: string) =>
    b.line(
      `${name.padEnd(nameW).slice(0, nameW)} ${price.padStart(priceW)} ${qty.padStart(qtyW)} ${total.padStart(totalW)}`,
    )

  if (nameW >= 10) {
    // Wide enough for real columns: Item | Price | Qty | Total.
    b.bold(true)
    itemCols(labels.description, labels.price, labels.qty, labels.total)
    b.bold(false)
    for (const item of input.items) {
      if (item.productName.length <= nameW) {
        itemCols(item.productName, plain(item.unitPrice), String(item.qty), plain(item.lineTotal))
      } else {
        // Wrap rather than truncate — a customer should be able to read the
        // whole product name; the numbers then sit on their own row below.
        for (const part of wrap(item.productName, width)) b.line(part)
        itemCols('', plain(item.unitPrice), String(item.qty), plain(item.lineTotal))
      }
    }
  } else {
    // Narrow roll: name line(s), then "price x qty" against the line total.
    b.bold(true).pair(labels.description, labels.total).bold(false)
    for (const item of input.items) {
      for (const part of wrap(item.productName, width)) b.line(part)
      b.pair(`  ${plain(item.unitPrice)} x ${item.qty}`, plain(item.lineTotal), st.pairLeader)
    }
  }

  divider()

  // --- totals ---
  // Subtotal and discount always print, so a customer can see at a glance that
  // no discount was applied (0.00) rather than wondering if a line is missing.
  b.align('left')
  b.pair(labels.subtotal, money(input.subtotal), st.pairLeader)
  b.pair(
    labels.discount,
    input.discount > 0 ? `- ${money(input.discount)}` : money(0),
    st.pairLeader,
  )
  if (st.boxTotal) divider()
  b.bold(true).pair(labels.total, money(input.total), st.pairLeader).bold(false)
  if (st.boxTotal) divider()
  for (const payment of input.payments) {
    b.pair(paymentLabel(payment.method, labels), money(payment.amount), st.pairLeader)
  }
  if (change > 0) b.pair(labels.change, money(change), st.pairLeader)

  divider()

  // --- footer ---
  // The footer message is optional, like the header: empty prints nothing.
  b.align('center')
  const footerText = input.receiptFooter?.trim()
  if (footerText) b.bold(true).line(footerText).bold(false)

  b.feed(1)
  b.barcode(input.invoiceNo)

  // Promo line below the barcode; the feed keeps it clear of the HRI digits.
  b.feed(1)
  for (const line of wrap(labels.customSoftwareSupport, width)) b.line(line)

  // Kaarobar mark under the barcode. It is only available as an SVG data URL
  // (which nativeImage cannot decode), so use the packaged PNG instead.
  b.feed(1)
  b.raster(encodeImageRaster(kaarobarMarkPath(), 120))
  b.line('Kaarobar')

  return b.cut().build()
}

/**
 * The Kaarobar mark shipped with the app. `public/` is copied into the build
 * output, so resolve relative to the app path in production and the project root
 * in development.
 */
function kaarobarMarkPath(): string {
  const appPath = app.getAppPath()
  // Packaged: public/ has been copied into dist/. Development: both exist.
  const candidates = [
    path.join(appPath, 'dist', 'kaarobar-icon.png'),
    path.join(appPath, 'public', 'kaarobar-icon.png'),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]
}

/**
 * A language the receipt can actually be printed in.
 *
 * ESC/POS text goes out as CP437, which covers Latin script and nothing else.
 * Urdu and Arabic labels encode to a row of '?' — worse than useless on a
 * receipt — so those fall back to English rather than printing nothing legible.
 *
 * This is a floor, not a solution: product and customer names typed in Urdu
 * still cannot be rendered by the print head's character generator. Printing a
 * genuinely Urdu receipt means rasterising the text as an image instead.
 */
function printableLanguage(language: PrintLanguage): PrintLanguage {
  const labels = getSalePrintLabels(language)
  const printable = Object.values(labels).every(isCp437Printable)
  return printable ? language : 'en'
}

/**
 * Currency marker the printer can render.
 *
 * Seven of the supported currencies use a symbol outside CP437 (EUR, GBP, INR,
 * AED, SAR, TRY, EGP). Printing those as '?' would leave every amount on the
 * receipt unlabelled, so fall back to the ISO code, which is unambiguous.
 */
function printableCurrency(currency: string): string {
  const prefix = currencyPrefix(currency)
  if (isCp437Printable(prefix)) return prefix
  return (currency || '').trim().toUpperCase() || prefix
}

/** Address / phone / custom header, in print order. Wrapped by the caller. */
function headerLines(input: ReceiptSaleInput, telLabel: string): string[] {
  const out: string[] = []
  if (input.branchAddress) out.push(input.branchAddress)
  if (input.branchPhone) out.push(`${telLabel}: ${input.branchPhone}`)
  if (input.receiptHeader?.trim()) out.push(input.receiptHeader.trim())
  return out
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
