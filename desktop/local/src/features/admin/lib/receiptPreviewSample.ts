import type { ReceiptPreviewSample } from '../../../../shared/types/api'

/**
 * Fabricated sale used to preview receipts in Business Settings. Real business
 * and branch data comes from the caller; the sale itself (items, totals,
 * invoice number) is a fixed sample so previews look alike everywhere.
 */

export type ReceiptSampleSource = {
  businessName: string
  currency: string
  brandColor?: string | null
  logoPath: string | null
  branchAddress: string
  branchPhone: string
  receiptHeader: string
  receiptFooter: string
  socialWhatsapp?: string | null
  socialInstagram?: string | null
  socialFacebook?: string | null
  socialTiktok?: string | null
  socialWebsite?: string | null
}

// One timestamp per app session: a per-render `new Date()` would make every
// preview payload unique and re-render the iframe on unrelated state changes.
const SAMPLE_CREATED_AT = new Date().toISOString()

export function buildReceiptSample(
  source: ReceiptSampleSource,
  t: (key: string) => string,
): ReceiptPreviewSample {
  const items = [
    { productName: t('printer.sampleItem1'), qty: 2, unitPrice: 125, lineTotal: 250 },
    { productName: t('printer.sampleItem2'), qty: 1, unitPrice: 80, lineTotal: 80 },
  ]
  const total = items.reduce((sum, item) => sum + item.lineTotal, 0)

  return {
    invoiceNo: 'KB-PREV-MB-1',
    subtotal: total,
    discount: 0,
    total,
    amountPaid: total,
    createdAt: SAMPLE_CREATED_AT,
    businessName: source.businessName.trim() || t('printer.sampleShop'),
    currency: source.currency,
    brandColor: source.brandColor ?? null,
    logoPath: source.logoPath,
    customerName: null,
    cashierName: t('printer.sampleCashier'),
    printedByName: null,
    receiptHeader: source.receiptHeader.trim() || null,
    receiptFooter: source.receiptFooter.trim() || null,
    branchAddress: source.branchAddress.trim() || null,
    branchPhone: source.branchPhone.trim() || null,
    socialWhatsapp: source.socialWhatsapp ?? null,
    socialInstagram: source.socialInstagram ?? null,
    socialFacebook: source.socialFacebook ?? null,
    socialTiktok: source.socialTiktok ?? null,
    socialWebsite: source.socialWebsite ?? null,
    items,
    payments: [{ method: 'cash', amount: total }],
  }
}
