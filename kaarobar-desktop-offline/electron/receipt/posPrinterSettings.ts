import { appStore } from '../config/store'

/** Paper widths electron-pos-printer understands. */
export const POS_PAPER_WIDTHS = ['58mm', '76mm', '80mm'] as const
export type PosPaperWidth = (typeof POS_PAPER_WIDTHS)[number]

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
}

const DEFAULTS: PosPrinterSettings = {
  // Mirrors the store defaults — see electron/config/store.ts.
  posPrintEnabled: true,
  posPrinterName: '',
  posPaperWidth: '80mm',
  posSilent: true,
  posCopies: 1,
}

function normalizeWidth(value: unknown): PosPaperWidth {
  return POS_PAPER_WIDTHS.includes(value as PosPaperWidth)
    ? (value as PosPaperWidth)
    : DEFAULTS.posPaperWidth
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
  return getPosPrinterSettings()
}
