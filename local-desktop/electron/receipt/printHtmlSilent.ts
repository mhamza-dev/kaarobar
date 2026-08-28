import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { BrowserWindow } from 'electron'
import { getKaarobarDataDir } from '../config/paths'

export type PrintHtmlOptions = {
  html: string
  /** Empty means the OS default queue. */
  printerName?: string
  copies?: number
  /**
   * Skip the OS print dialog (default). Set false to let the user pick the
   * printer per job — the dialog then reports `cancelled` when dismissed.
   */
  silent?: boolean
  /**
   * Explicit page size for sheet layouts. Left unset for roll receipts on
   * purpose: a thermal driver's default is its roll width, and naming a size
   * would fight it. For A4/Letter layouts the driver default is usually right
   * too, but passing it pins the layout to the paper the document was built
   * for.
   */
  pageSize?: 'A4' | 'Letter'
}

export type PrintHtmlOutcome = 'printed' | 'cancelled'

/** A stuck spooler or driver dialog must not hang the till forever. */
const LOAD_TIMEOUT_MS = 30_000
const PRINT_TIMEOUT_MS = 120_000

/**
 * Print an HTML document without ever showing a window.
 *
 * This is the transport that works on *any* printer with a driver — thermal or
 * ink/laser — on all three platforms, because the rendering is Chromium's and the
 * driver only ever receives a rasterised page. The ESC/POS path is faster and
 * sharper but is thermal-only, so this is the general case.
 */
export async function printHtmlSilent(options: PrintHtmlOptions): Promise<PrintHtmlOutcome> {
  const filePath = writeTempHtml(options.html)

  // `show: false` is the whole point — the document is rendered offscreen and
  // goes straight to the spooler, with no preview for the cashier to dismiss.
  //
  // JavaScript stays enabled: the receipt draws its barcode with JsBarcode, and
  // disabling scripts would silently print a receipt with a blank barcode.
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true },
  })

  try {
    // No extra wait: the receipt draws its barcode from a plain <script> that
    // runs while the document is parsed, so it is already in the DOM by the time
    // loadFile resolves. Verified — the barcode element is fully populated at
    // this point. Keep the receipt template free of deferred/async rendering or
    // this assumption breaks. The timeout is belt-and-braces: the document is
    // local and self-contained, so a load that takes 30s is already broken.
    await withTimeout(
      win.loadFile(filePath),
      LOAD_TIMEOUT_MS,
      'The receipt document did not finish loading',
    )

    // One job per copy rather than the driver's `copies` field, which plenty of
    // thermal drivers quietly ignore. Sequential, so a failure on copy 2 is
    // reported instead of being lost behind a "job submitted" result.
    const copies = Math.min(Math.max(Math.trunc(options.copies ?? 1), 1), 5)
    for (let copy = 0; copy < copies; copy += 1) {
      const outcome = await printOnce(win, options)
      // The user closed the print dialog — stop, don't re-ask once per copy.
      if (outcome === 'cancelled') return 'cancelled'
    }
    return 'printed'
  } finally {
    if (!win.isDestroyed()) win.destroy()
    remove(filePath)
  }
}

function printOnce(win: BrowserWindow, options: PrintHtmlOptions): Promise<PrintHtmlOutcome> {
  return new Promise((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error('The printer did not accept the job in time'))
    }, PRINT_TIMEOUT_MS)

    win.webContents.print(
      {
        silent: options.silent ?? true,
        printBackground: true,
        // Empty deviceName means "OS default", which is what a single-printer
        // till wants when nothing has been configured.
        deviceName: options.printerName || undefined,
        margins: { marginType: 'none' },
        copies: 1,
        ...(options.pageSize ? { pageSize: options.pageSize } : {}),
      },
      (success, failureReason) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (success) {
          resolve('printed')
        } else if (/cancel/i.test(failureReason || '')) {
          // Dismissing the OS dialog is a choice, not a printer failure —
          // reporting it as an error would trigger the preview fallback the
          // user just declined.
          resolve('cancelled')
        } else {
          reject(new Error(failureReason || 'The print job was not accepted'))
        }
      },
    )
  })
}

function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${what} (${ms / 1000}s timeout)`)), ms)
    work.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function writeTempHtml(html: string): string {
  const dir = path.join(getKaarobarDataDir(), 'print')
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, `job-${randomUUID()}.html`)
  fs.writeFileSync(filePath, html, 'utf8')
  return filePath
}

function remove(filePath: string): void {
  try {
    fs.unlinkSync(filePath)
  } catch {
    // Best effort — a stray file in the print scratch dir is harmless.
  }
}
