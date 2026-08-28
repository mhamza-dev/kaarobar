import { execFile } from 'node:child_process'
import { BrowserWindow } from 'electron'

export type PrinterDevice = {
  name: string
  displayName: string
  description: string
  isDefault: boolean
}

/** Printers the OS exposes. */
export async function listPrinters(): Promise<PrinterDevice[]> {
  const win = BrowserWindow.getAllWindows()[0]
  if (!win) return []
  const printers = await win.webContents.getPrintersAsync()
  const osDefault = await getOsDefaultPrinterName()

  return printers.map((printer) => {
    // `isDefault` is not stable across Electron majors — in some versions it
    // lives on the record, in others only inside `options`. Read both, then fall
    // back to the OS, which is the only reliable source on Windows (see below).
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
      raw.options?.['is-default'] === 'true' ||
      (osDefault !== '' && raw.name === osDefault)
    return {
      name: raw.name,
      displayName: raw.displayName || raw.name,
      description: raw.description || '',
      isDefault,
    }
  })
}

/**
 * Software queues that accept a job and produce a file (or a dialog) instead of
 * paper. Windows ships several and one of them is very often the machine default,
 * so a till that never had a printer explicitly chosen would otherwise send every
 * receipt into a PDF nobody opens.
 */
const VIRTUAL_PRINTER_PATTERNS = [
  /microsoft print to pdf/i,
  /microsoft xps document writer/i,
  /onenote/i,
  /\bfax\b/i,
  /adobe pdf/i,
  /(foxit|cutepdf|bullzip|dopdf|pdf24|pdfcreator|nitro pdf|primopdf)/i,
  /print to file/i,
]

function isVirtual(printer: PrinterDevice): boolean {
  const haystack = `${printer.name} ${printer.displayName}`
  return VIRTUAL_PRINTER_PATTERNS.some((pattern) => pattern.test(haystack))
}

/**
 * Queue names that very strongly suggest a thermal receipt printer: vendor
 * prefixes (Epson TM, Xprinter XP, Rongta RP, …), the generic text-only driver
 * such printers are commonly installed with, and the usual POS/thermal/roll
 * keywords. Used only to *prefer* a device, never to exclude one.
 */
const THERMAL_PRINTER_PATTERNS = [
  /thermal/i,
  /receipt/i,
  /\bpos\b/i,
  /pos[-_ ]?(58|76|80)/i,
  /\b(58|76|80)\s?mm\b/i,
  /generic\s*\/?\s*text/i,
  /\btm[-_ ]?[a-z]?\d/i, // Epson TM-T20, TM-U220, ...
  /\bxp[-_ ]?\d{2,}/i, // Xprinter XP-58, XP-80, ...
  /\brp[-_ ]?\d{2,}/i, // Rongta RP80, ...
  /\bzj[-_ ]?\d/i, // Zjiang ZJ-58, ...
  /rongta|gprinter|goojprt|hoin|zjiang|bixolon|sewoo|sam4s|metapace/i,
  /star\s*tsp/i,
  /citizen\s*ct/i,
]

/** Does this queue look like a thermal receipt printer? */
export function looksLikeThermalPrinter(printer: PrinterDevice): boolean {
  const haystack = `${printer.name} ${printer.displayName} ${printer.description}`
  return THERMAL_PRINTER_PATTERNS.some((pattern) => pattern.test(haystack))
}

/**
 * The printer a job should go to when none is configured.
 *
 * Prefers whatever the OS calls the default. Failing that, prefers a real device
 * over Windows' built-in PDF/XPS/fax queues, since a receipt printer is rarely
 * the machine default. The virtual-printer check only ever *reorders* candidates:
 * if everything looks virtual the first entry is still returned, so a thermal
 * printer with an unlucky name cannot be filtered out of existence.
 *
 * `preferThermal` is for raw ESC/POS jobs: those bytes only mean something to a
 * thermal printer, so when one is attached it should win even if the machine
 * default is the office inkjet.
 */
export async function resolveDefaultPrinterName(
  options: { preferThermal?: boolean } = {},
): Promise<string> {
  const printers = await listPrinters()
  if (!printers.length) return ''

  const real = printers.filter((p) => !isVirtual(p))
  const pool = real.length ? real : printers

  if (options.preferThermal) {
    const thermal = pool.filter(looksLikeThermalPrinter)
    if (thermal.length) {
      return (thermal.find((p) => p.isDefault) ?? thermal[0]).name
    }
  }

  return (pool.find((p) => p.isDefault) ?? pool[0]).name
}

/**
 * The platform query below spawns a process (PowerShell / lpstat), which costs
 * real time on the sale path — a second per receipt on some Windows machines.
 * The default printer changes rarely, so cache it briefly instead of paying
 * that on every print.
 */
const OS_DEFAULT_TTL_MS = 30_000
let osDefaultCache: { value: string; at: number } | null = null

/**
 * The OS's own default printer.
 *
 * Electron's `getPrintersAsync()` is not enough on its own: on Windows it returns
 * every record with an empty `description`, empty `options` and no `isDefault`
 * field at all, so nothing in the list marks the default. Ask the platform
 * directly instead.
 *
 * Returns '' when the default cannot be determined — callers fall back to
 * picking from the list.
 */
async function getOsDefaultPrinterName(): Promise<string> {
  if (osDefaultCache && Date.now() - osDefaultCache.at < OS_DEFAULT_TTL_MS) {
    return osDefaultCache.value
  }
  const value = await queryOsDefaultPrinterName()
  osDefaultCache = { value, at: Date.now() }
  return value
}

async function queryOsDefaultPrinterName(): Promise<string> {
  try {
    if (process.platform === 'win32') {
      // Win32_Printer is the only place that carries the Default flag.
      const out = await run('powershell.exe', [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '(Get-CimInstance Win32_Printer | Where-Object { $_.Default } | Select-Object -First 1 -ExpandProperty Name)',
      ])
      return out.trim()
    }

    // CUPS: "system default destination: NAME"
    const out = await run('lpstat', ['-d'])
    return out.split(':')[1]?.trim() ?? ''
  } catch {
    // No default configured, or the query tool is unavailable. Not fatal.
    return ''
  }
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: 5000, windowsHide: true, encoding: 'utf8' },
      (error, stdout) => {
        if (error) reject(error)
        else resolve(stdout)
      },
    )
  })
}
