import { createRequire } from 'node:module'
import { CHARS_PER_LINE, EscPosBuilder } from './escpos'
import { getPosPrinterSettings } from './posPrinterSettings'

const require = createRequire(import.meta.url)
const { PosPrinter } =
  require('electron-pos-printer') as typeof import('electron-pos-printer')

export type PrinterTestKind = 'rendered' | 'raw'

export type PrinterTestResult = {
  kind: PrinterTestKind
  ok: boolean
  printerName: string
  error?: string
}

/**
 * Prints a short, unmistakable page through ONE transport so the two can be
 * compared on paper.
 *
 * - `rendered` goes HTML -> Chromium -> printer driver (what electron-pos-printer
 *   and the old preview window both do).
 * - `raw` sends ESC/POS bytes straight to the queue, bypassing rendering.
 *
 * If `raw` is readable and `rendered` prints markup or garbage, the queue is a
 * raw/passthrough one and receipts must be produced as ESC/POS.
 */
export async function testPrint(kind: PrinterTestKind): Promise<PrinterTestResult> {
  const settings = getPosPrinterSettings()
  const printerName = settings.posPrinterName || ''
  const base: PrinterTestResult = { kind, ok: false, printerName: printerName || 'system default' }

  try {
    if (kind === 'raw') {
      if (!printerName) {
        throw new Error(
          'Raw printing needs an explicit printer. Pick one in Settings → Receipt printer first.',
        )
      }
      const width = CHARS_PER_LINE[settings.posPaperWidth] ?? 48
      const buf = new EscPosBuilder(width)
        .init()
        .align('center')
        .bold(true)
        .size(1, 1)
        .line('RAW ESC/POS TEST')
        .size(0, 0)
        .bold(false)
        .line('If you can read this cleanly,')
        .line('use RAW for receipts.')
        .align('left')
        .rule()
        .pair('Paper', settings.posPaperWidth)
        .pair('Chars/line', String(width))
        .rule()
        .align('center')
        .barcode('KAAROBAR1')
        .cut()
        .build()

      await PosPrinter.sendRawCommand(printerName, buf)
      return { ...base, ok: true }
    }

    await PosPrinter.print(
      [
        {
          type: 'text',
          value: 'RENDERED HTML TEST',
          style: { textAlign: 'center', fontWeight: '700', fontSize: '16px' },
        },
        {
          type: 'text',
          value: 'If this prints as readable text, the driver renders correctly.',
          style: { textAlign: 'center', fontSize: '12px' },
        },
        {
          type: 'text',
          value: 'If you instead see HTML tags, the queue is raw — use RAW mode.',
          style: { textAlign: 'center', fontSize: '12px' },
        },
      ],
      {
        printerName: printerName || undefined,
        silent: settings.posSilent,
        preview: false,
        copies: 1,
        pageSize: settings.posPaperWidth,
        margin: '0 0 0 0',
        timeOutPerLine: 400,
      },
    )
    return { ...base, ok: true }
  } catch (error) {
    return { ...base, error: error instanceof Error ? error.message : String(error) }
  }
}
