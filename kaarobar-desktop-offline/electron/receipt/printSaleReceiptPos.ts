import { BrowserWindow } from 'electron'
import { createRequire } from 'node:module'
import { buildSaleReceiptPos } from './buildSaleReceiptPos'
import type { ReceiptSaleInput } from './buildSaleReceiptHtml'
import { getPosPrinterSettings } from './posPrinterSettings'

// electron-pos-printer is CommonJS while this main-process bundle is ESM, so a
// named import throws at load: "Named export 'PosPrinter' not found". Go through
// createRequire — the same interop this codebase already uses for CJS deps.
const require = createRequire(import.meta.url)
const { PosPrinter } =
  require('electron-pos-printer') as typeof import('electron-pos-printer')

export type PrinterDevice = {
  name: string
  displayName: string
  description: string
  isDefault: boolean
}

/** Printers the OS exposes, for the settings picker. */
export async function listPrinters(): Promise<PrinterDevice[]> {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return []
  const printers = await win.webContents.getPrintersAsync()
  return printers.map((printer) => {
    // `isDefault` is not stable across Electron majors — in some versions it
    // lives on the record, in others only inside `options`. Read both.
    const raw = printer as unknown as {
      name: string
      displayName?: string
      description?: string
      isDefault?: boolean
      options?: Record<string, unknown>
    }
    const isDefault =
      raw.isDefault === true ||
      raw.options?.['printer-is-default'] === true ||
      raw.options?.['is-default'] === 'true'
    return {
      name: raw.name,
      displayName: raw.displayName || raw.name,
      description: raw.description || '',
      isDefault,
    }
  })
}

/**
 * Print a sale receipt to the configured POS printer.
 *
 * Throws on failure so the caller can fall back to the HTML preview rather than
 * silently dropping the receipt — a till that prints nothing is worse than one
 * that opens a window.
 */
export async function printSaleReceiptToPos(input: ReceiptSaleInput): Promise<void> {
  const settings = getPosPrinterSettings()
  const data = buildSaleReceiptPos(input)

  await PosPrinter.print(data, {
    printerName: settings.posPrinterName || undefined,
    // `silent` needs a printerName to be meaningful; without one the OS default
    // is used, which is still what a single-printer till wants.
    silent: settings.posSilent,
    preview: false,
    copies: settings.posCopies,
    pageSize: settings.posPaperWidth,
    margin: '0 0 0 0',
    // The library waits `data.length * timeOutPerLine` ms before resolving.
    // Receipts are short, so keep this small or every sale blocks the till.
    timeOutPerLine: 400,
  })
}
