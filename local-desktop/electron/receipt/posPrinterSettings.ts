import { appStore } from '../config/store'
import { getLicenseLimits } from '../licensing/service'

/**
 * Paper the receipt is laid out for. The roll widths are thermal receipt
 * printers; A4/Letter are ordinary ink/laser office printers, which get a
 * full-page layout instead of a narrow strip.
 */
export const POS_PAPER_WIDTHS = ['58mm', '76mm', '80mm', 'A4', 'Letter'] as const
export type PosPaperWidth = (typeof POS_PAPER_WIDTHS)[number]

/** Roll (thermal) sizes — the only ones raw ESC/POS output makes sense for. */
export function isRollPaper(width: PosPaperWidth): boolean {
  return width === '58mm' || width === '76mm' || width === '80mm'
}

/**
 * `raw` sends ESC/POS bytes straight to the queue. `rendered` goes
 * HTML -> Chromium -> OS driver, which only works when the printer has a real
 * driver — on a raw/passthrough queue it prints the PostScript source instead.
 */
export type PosTransport = 'raw' | 'rendered'

/**
 * Visual style of the printed receipt. Purely presentational — every template
 * prints the same sections in the same order (see receipt/receiptTemplates.ts).
 */
export const POS_RECEIPT_TEMPLATES = [
  'classic',
  'minimal',
  'dotted',
  'mono',
  'bold',
  'elegant',
  'boxed',
  'stripe',
  'soft',
  'script',
  'accent',
  'framed',
  'duo',
  'vintage',
  'ticket',
  'ledger',
  'deluxe',
  'wave',
  'market',
  'regal',
] as const
export type PosReceiptTemplate = (typeof POS_RECEIPT_TEMPLATES)[number]

export type PosPrinterSettings = {
  /**
   * When false, printing keeps using the HTML preview window. The POS path is
   * opt-in because it only makes sense once a receipt printer is attached.
   */
  posPrintEnabled: boolean
  /** Device name as reported by `webContents.getPrintersAsync()`. Empty = OS default. */
  posPrinterName: string
  posPaperWidth: PosPaperWidth
  /** Skip the OS print dialog. This is the point of a till printer. */
  posSilent: boolean
  posCopies: number
  posTransport: PosTransport
  posTemplate: PosReceiptTemplate
}

/**
 * The transport that will actually be used for a print job. ESC/POS bytes are
 * meaningless to an ink/laser printer, so sheet paper always renders through
 * the driver regardless of the stored transport.
 */
export function effectiveTransport(settings: PosPrinterSettings): PosTransport {
  return isRollPaper(settings.posPaperWidth) ? settings.posTransport : 'rendered'
}

const DEFAULTS: PosPrinterSettings = {
  // Mirrors the store defaults — see electron/config/store.ts.
  posPrintEnabled: true,
  posPrinterName: '',
  posPaperWidth: '80mm',
  posSilent: true,
  posCopies: 1,
  posTransport: 'raw',
  posTemplate: 'classic',
}

export function normalizeWidth(value: unknown): PosPaperWidth {
  return POS_PAPER_WIDTHS.includes(value as PosPaperWidth)
    ? (value as PosPaperWidth)
    : DEFAULTS.posPaperWidth
}

export function normalizeTemplate(value: unknown): PosReceiptTemplate {
  return POS_RECEIPT_TEMPLATES.includes(value as PosReceiptTemplate)
    ? (value as PosReceiptTemplate)
    : DEFAULTS.posTemplate
}

/**
 * License plans unlock the first N receipt layouts (in POS_RECEIPT_TEMPLATES
 * order). A template beyond the plan's allowance falls back to classic — this
 * also demotes a stored choice if a device ever ends up on a smaller plan.
 */
function clampTemplateToPlan(template: PosReceiptTemplate): PosReceiptTemplate {
  const { maxTemplates } = getLicenseLimits()
  if (!Number.isFinite(maxTemplates)) return template
  const index = POS_RECEIPT_TEMPLATES.indexOf(template)
  return index < maxTemplates ? template : DEFAULTS.posTemplate
}

function normalizeCopies(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1
  return Math.min(Math.max(Math.trunc(n), 1), 5)
}

export function getPosPrinterSettings(): PosPrinterSettings {
  return {
    posPrintEnabled:
      (appStore.get('posPrintEnabled') as boolean | undefined) ?? DEFAULTS.posPrintEnabled,
    posPrinterName:
      (appStore.get('posPrinterName') as string | undefined) ?? DEFAULTS.posPrinterName,
    posPaperWidth: normalizeWidth(appStore.get('posPaperWidth')),
    posSilent: (appStore.get('posSilent') as boolean | undefined) ?? DEFAULTS.posSilent,
    posCopies: normalizeCopies(appStore.get('posCopies')),
    posTransport:
      appStore.get('posTransport') === 'rendered' ? 'rendered' : DEFAULTS.posTransport,
    posTemplate: clampTemplateToPlan(normalizeTemplate(appStore.get('posTemplate'))),
  }
}

export function setPosPrinterSettings(
  payload: Partial<PosPrinterSettings>,
): PosPrinterSettings {
  if (typeof payload.posPrintEnabled === 'boolean') {
    appStore.set('posPrintEnabled', payload.posPrintEnabled)
  }
  if (typeof payload.posPrinterName === 'string') {
    appStore.set('posPrinterName', payload.posPrinterName.trim())
  }
  if (payload.posPaperWidth !== undefined) {
    appStore.set('posPaperWidth', normalizeWidth(payload.posPaperWidth))
  }
  if (typeof payload.posSilent === 'boolean') {
    appStore.set('posSilent', payload.posSilent)
  }
  if (payload.posCopies !== undefined) {
    appStore.set('posCopies', normalizeCopies(payload.posCopies))
  }
  if (payload.posTransport === 'raw' || payload.posTransport === 'rendered') {
    appStore.set('posTransport', payload.posTransport)
  }
  if (payload.posTemplate !== undefined) {
    appStore.set('posTemplate', clampTemplateToPlan(normalizeTemplate(payload.posTemplate)))
  }
  return getPosPrinterSettings()
}
