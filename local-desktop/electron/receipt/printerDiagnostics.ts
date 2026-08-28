import {
  DOTS_PER_CHAR,
  EDGE_MARGIN_CHARS,
  EscPosBuilder,
  usableChars,
} from './escpos'
import {
  getPosPrinterSettings,
  isRollPaper,
  type PosPaperWidth,
} from './posPrinterSettings'
import { resolveDefaultPrinterName } from './printerDevices'
import { printHtmlSilent } from './printHtmlSilent'
import { sendRawToPrinter } from './rawPrint'
import type { PrinterTestKind, PrinterTestResult } from '../../shared/types/api'

export type { PrinterTestKind, PrinterTestResult }

/**
 * Prints a short, unmistakable page through ONE transport so the two can be
 * compared on paper.
 *
 * - `rendered` goes HTML -> Chromium -> printer driver — the exact pipeline
 *   sale receipts use in rendered mode, not a lookalike.
 * - `raw` sends ESC/POS bytes straight to the queue, bypassing rendering.
 *
 * If `raw` is readable and `rendered` prints markup or garbage, the queue is a
 * raw/passthrough one and receipts must be produced as ESC/POS.
 */
export async function testPrint(kind: PrinterTestKind): Promise<PrinterTestResult> {
  const settings = getPosPrinterSettings()
  const configuredName = settings.posPrinterName || ''
  const base: PrinterTestResult = {
    kind,
    ok: false,
    printerName: configuredName || 'system default',
  }

  try {
    if (kind === 'raw') {
      // Raw jobs address a queue by name; there is no "OS default" for them.
      // Prefer a thermal-looking queue — ESC/POS bytes are for thermal heads.
      const printerName =
        configuredName || (await resolveDefaultPrinterName({ preferThermal: true }))
      if (!printerName) {
        throw new Error('Raw printing needs a printer, and none is installed on this machine.')
      }
      // A sheet size means an office printer is configured — testing it with a
      // roll width would prove nothing, so fall back to the widest roll.
      const paper: PosPaperWidth = isRollPaper(settings.posPaperWidth)
        ? settings.posPaperWidth
        : '80mm'
      const width = usableChars(paper)
      const buf = new EscPosBuilder(width)
        .init()
        .leftMargin(EDGE_MARGIN_CHARS * DOTS_PER_CHAR)
        .printWidth(width * DOTS_PER_CHAR)
        .align('center')
        .bold(true)
        .size(1, 1)
        .line('RAW ESC/POS TEST')
        .size(0, 0)
        .bold(false)
        .line('If you can read this cleanly,')
        .line('use DIRECT THERMAL for receipts.')
        .align('left')
        .rule()
        .pair('Paper', paper)
        .pair('Chars/line', String(width))
        .rule()
        .align('center')
        .barcode('KAAROBAR1')
        .cut()
        .build()

      await sendRawToPrinter(printerName, buf, 'Kaarobar raw test')
      return { ...base, ok: true, printerName }
    }

    const sheet = !isRollPaper(settings.posPaperWidth)
    const outcome = await printHtmlSilent({
      html: renderedTestHtml(settings.posPaperWidth),
      printerName: configuredName || undefined,
      copies: 1,
      silent: settings.posSilent,
      pageSize: sheet ? (settings.posPaperWidth as 'A4' | 'Letter') : undefined,
    })
    if (outcome === 'cancelled') {
      return { ...base, error: 'The print dialog was closed before printing.' }
    }
    return { ...base, ok: true }
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Small self-contained page for the rendered test. Sized like a real receipt
 * for roll paper and like a document for sheet paper, so the test exercises
 * the geometry the actual receipt will use.
 */
function renderedTestHtml(paper: PosPaperWidth): string {
  const roll = isRollPaper(paper)
  const contentWidth = paper === '58mm' ? '48mm' : paper === '76mm' ? '64mm' : '72mm'
  const bodyCss = roll
    ? `width: ${contentWidth}; padding: 2mm;`
    : 'max-width: 180mm; margin: 0 auto; padding: 12mm 10mm;'
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body { ${bodyCss} font-family: 'Segoe UI', ui-sans-serif, sans-serif; color: #111; background: #fff; margin: 0; }
    h1 { font-size: ${roll ? '14px' : '20px'}; text-align: center; letter-spacing: 0.5px; margin: 0 0 8px; }
    p { font-size: ${roll ? '11px' : '13px'}; text-align: center; margin: 4px 0; line-height: 1.4; }
    .rule { border-top: 1px dashed #333; margin: 8px 0; }
  </style>
</head>
<body>
  <h1>RENDERED PRINT TEST</h1>
  <div class="rule"></div>
  <p>If this prints as readable text, your printer's driver renders correctly — use this mode for receipts.</p>
  <p>If you instead see HTML tags or PostScript source, the queue is raw — switch to DIRECT THERMAL mode.</p>
  <div class="rule"></div>
  <p>Paper: ${paper}</p>
</body>
</html>`
}
