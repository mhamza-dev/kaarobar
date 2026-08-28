import { requireSession } from '../auth/guards'
import type {
  ReceiptPreviewPayload,
  ReceiptPreviewResult,
  ReceiptPreviewSample,
} from '../../shared/types/api'
import { buildSaleReceiptHtml, type ReceiptSaleInput } from './buildSaleReceiptHtml'
import { loadJsBarcodeScript } from './jsBarcodeScript'
import { normalizeTemplate, normalizeWidth } from './posPrinterSettings'

/**
 * Renders a settings-page receipt preview through the real print engine, so
 * the preview is exactly what a sale would print. Stateless: the renderer
 * supplies the whole sample (it already holds the business/branch data), and
 * this only adds the barcode script and resolves the paper/template.
 */
export async function buildReceiptPreviewHtml(
  payload: ReceiptPreviewPayload,
): Promise<ReceiptPreviewResult> {
  requireSession()
  const sample = sanitizeSample(payload?.sample)
  const input: ReceiptSaleInput = {
    ...sample,
    jsBarcodeScript: loadJsBarcodeScript(),
  }
  const html = await buildSaleReceiptHtml(input, {
    paper: normalizeWidth(payload?.paper),
    template: normalizeTemplate(payload?.template),
    reportHeightToParent: true,
  })
  return { html }
}

const str = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const strOrNull = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

/**
 * IPC payloads are untyped at runtime; coerce every field so a malformed
 * request degrades to an empty-ish sample instead of a crash mid-render.
 */
function sanitizeSample(sample: unknown): ReceiptPreviewSample {
  const raw = (sample ?? {}) as Record<string, unknown>
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .slice(0, 20)
    .map((item) => {
      const entry = (item ?? {}) as Record<string, unknown>
      return {
        productName: str(entry.productName),
        qty: num(entry.qty, 1),
        unitPrice: num(entry.unitPrice),
        lineTotal: num(entry.lineTotal),
      }
    })
  const payments = (Array.isArray(raw.payments) ? raw.payments : [])
    .slice(0, 8)
    .map((payment) => {
      const entry = (payment ?? {}) as Record<string, unknown>
      return { method: str(entry.method, 'cash'), amount: num(entry.amount) }
    })
  return {
    invoiceNo: str(raw.invoiceNo, 'PREVIEW'),
    subtotal: num(raw.subtotal),
    discount: num(raw.discount),
    total: num(raw.total),
    amountPaid: num(raw.amountPaid),
    createdAt: str(raw.createdAt, new Date().toISOString()),
    businessName: str(raw.businessName),
    currency: str(raw.currency, 'PKR'),
    brandColor: strOrNull(raw.brandColor),
    logoPath: strOrNull(raw.logoPath),
    customerName: strOrNull(raw.customerName),
    cashierName: strOrNull(raw.cashierName),
    printedByName: strOrNull(raw.printedByName),
    receiptHeader: strOrNull(raw.receiptHeader),
    receiptFooter: strOrNull(raw.receiptFooter),
    branchAddress: strOrNull(raw.branchAddress),
    branchPhone: strOrNull(raw.branchPhone),
    socialWhatsapp: strOrNull(raw.socialWhatsapp),
    socialInstagram: strOrNull(raw.socialInstagram),
    socialFacebook: strOrNull(raw.socialFacebook),
    socialTiktok: strOrNull(raw.socialTiktok),
    socialWebsite: strOrNull(raw.socialWebsite),
    items,
    payments,
  }
}
