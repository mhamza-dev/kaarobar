import fs from 'node:fs'
import { createRequire } from 'node:module'

const requireModule = createRequire(import.meta.url)

let cachedScript: string | null = null

/**
 * The bundled JsBarcode source, inlined into receipt documents so they render
 * offline. Cached — the ~66KB bundle never changes within a run, and it is
 * needed on every print and settings preview. An empty string on failure keeps
 * the receipt printable — it just loses the barcode.
 */
export function loadJsBarcodeScript(): string {
  if (cachedScript !== null) return cachedScript
  try {
    const barcodePath = requireModule.resolve('jsbarcode/dist/JsBarcode.all.min.js')
    cachedScript = fs.readFileSync(barcodePath, 'utf8')
  } catch {
    cachedScript = ''
  }
  return cachedScript
}
