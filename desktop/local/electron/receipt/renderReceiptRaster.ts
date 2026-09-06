import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { BrowserWindow } from 'electron'

import {
  buildSaleReceiptHtml,
  ROLL_CONTENT_MM,
  type ReceiptSaleInput,
} from './buildSaleReceiptHtml'
import { DOTS_PER_CHAR, EDGE_MARGIN_CHARS, EscPosBuilder, usableChars } from './escpos'
import { rasterFromBgra } from './escposImage'
import type { PosPaperWidth, PosReceiptTemplate } from './posPrinterSettings'

/**
 * Printing a receipt the print head cannot spell.
 *
 * A thermal printer's character generator holds one single-byte code page —
 * CP437 here — which covers Latin script and nothing else. Urdu, Arabic,
 * Chinese and Thai all encode to a row of `?`. Selecting an Arabic code page
 * would not save it either: those pages carry isolated letterforms, and Urdu
 * needs contextual shaping (a letter looks different at the start, middle and
 * end of a word) plus right-to-left ordering. No printer does that.
 *
 * So the text is not sent as text. Chromium lays the receipt out — with real
 * fonts, real shaping and real RTL — the page is captured as a bitmap, and the
 * bitmap goes to the printer as an ESC/POS raster. The printer draws dots; it
 * does not need to know what script they form.
 *
 * ## Why this is not simply the default
 *
 * A raster is perhaps fifty times the bytes of the same receipt as text, and
 * slower off the head. For a Latin receipt the character generator is exactly
 * the right tool. This exists for the receipts where it is not.
 */

/** How wide a receipt is, in printer dots, for a given roll. */
export function paperDotWidth(paperWidth: PosPaperWidth): number {
  // The same usable-column arithmetic the text builder uses, so a rastered
  // receipt lands in the same place on the roll as a printed one.
  return usableChars(paperWidth) * DOTS_PER_CHAR
}

/** Where the raster begins, in dots, so both paths share one left margin. */
export function paperLeftMarginDots(): number {
  return EDGE_MARGIN_CHARS * DOTS_PER_CHAR
}

/** CSS's fixed idea of a millimetre. `1mm` is 96/25.4 px, on every screen. */
const CSS_PX_PER_MM = 96 / 25.4

/**
 * How wide the receipt document is *in its own terms* — CSS pixels.
 *
 * The templates lay a roll receipt out in millimetres (`body { width: 72mm }`)
 * because that is the honest unit for paper: a driver-rendered receipt then
 * prints at physical size whatever the printer's DPI. This converts that back
 * to the pixel width Chromium will actually lay out at, which is the number the
 * capture has to be reconciled with.
 */
function documentCssWidth(paperWidth: PosPaperWidth): number {
  return (ROLL_CONTENT_MM[paperWidth] ?? 72) * CSS_PX_PER_MM
}

/**
 * How much bigger a printer dot is than a CSS pixel, for this roll.
 *
 * This is the number that decides how big the text prints, and getting it wrong
 * is not subtle. A 72mm document is 272 CSS px wide; the same 72mm of paper is
 * 552 printer dots. Laying the document out at 552px and then treating each of
 * those pixels as one dot — which is what forcing the body to the dot width
 * did — squeezes a 272px-wide design across 552 dots of paper, so every glyph
 * comes off the head at 49% of the size the template asked for. Half size, on a
 * receipt a customer is handed.
 *
 * So the document keeps its own width and the *rendering* is zoomed instead:
 * Chromium lays out 272 CSS px and paints them across 552 device pixels, which
 * is both the correct physical scale and free supersampling for the glyphs.
 */
function dotsPerCssPx(paperWidth: PosPaperWidth): number {
  return paperDotWidth(paperWidth) / documentCssWidth(paperWidth)
}

export type RasterOptions = {
  /** Roll size — "58mm", "80mm". Decides the dot width. */
  paperWidth: PosPaperWidth
  /** Guard against a runaway document. Rolls are long, but not infinite. */
  maxHeightDots?: number
}

const DEFAULT_MAX_HEIGHT_DOTS = 6000
const LOAD_TIMEOUT_MS = 30_000

/**
 * Renders receipt HTML and returns it as ESC/POS raster bytes.
 *
 * Returns `null` when the page cannot be rendered or captured. The caller then
 * falls back to the driver path, which renders this same HTML — never to the
 * ESC/POS text path, which would report success while printing a page of `?`.
 */
export async function renderReceiptRaster(
  html: string,
  options: RasterOptions,
): Promise<Buffer | null> {
  const dotWidth = paperDotWidth(options.paperWidth)
  const maxHeight = options.maxHeightDots ?? DEFAULT_MAX_HEIGHT_DOTS
  const zoom = dotsPerCssPx(options.paperWidth)

  const filePath = writeTempHtml(wrapForRaster(html, ROLL_CONTENT_MM[options.paperWidth] ?? 72))

  // Offscreen, like the silent print path: no window ever appears, and the
  // cashier has nothing to dismiss.
  const win = new BrowserWindow({
    show: false,
    width: dotWidth,
    height: 1200,
    useContentSize: true,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      // The receipt draws its own barcode with JsBarcode from an inline
      // script. Disabling scripts here would raster a blank barcode.
      javascript: true,
    },
  })

  try {
    await withTimeout(
      win.loadFile(filePath),
      LOAD_TIMEOUT_MS,
      'The receipt document did not finish loading',
    )

    // Print the millimetres the template asked for, not the pixels it happened
    // to be laid out in. With the window `dotWidth` wide, this zoom makes the
    // CSS viewport exactly the document's own width, so the receipt fills the
    // roll at the size it was designed for. See dotsPerCssPx.
    win.webContents.setZoomFactor(zoom)

    // The document is one long column with no page breaks, so the window is
    // resized to the whole of it and captured in one go. Capturing a viewport
    // and stitching would leave a seam mid-line.
    //
    // measureHeight answers in CSS pixels; the window is sized in the zoomed
    // pixels the capture is made of, so it has to go through the same zoom the
    // width does or the bottom of the receipt is cut off.
    const contentHeight = Math.min(Math.ceil((await measureHeight(win)) * zoom), maxHeight)
    win.setContentSize(dotWidth, Math.max(1, contentHeight))

    // A repaint after a resize is not synchronous, and capturing before it
    // lands gives a bitmap of the old height with white at the bottom.
    await settleRepaint(win)

    const image = await win.webContents.capturePage()
    if (image.isEmpty()) return null

    // Two things at once. ESC/POS rasters are packed eight dots to a byte, so
    // the width has to be a multiple of eight — padded rather than cropped,
    // because a receipt narrowed by seven dots loses the right edge of the
    // totals column.
    //
    // And on a HiDPI screen — every Mac — `capturePage` returns a bitmap at
    // twice the window size. Resizing to the printer's dot width is what makes
    // the output identical on a Retina laptop and a shop's old monitor, and it
    // supersamples the glyphs for free while it is at it.
    const target = padToEight(dotWidth)
    const scaled = image.resize({ width: target, quality: 'best' })
    const scaledSize = scaled.getSize()

    if (scaledSize.width !== target || scaledSize.height <= 0) return null

    // Electron's own typings declare `getBitmap(): void`, which is wrong — it
    // returns the BGRA buffer, and `escposImage.rasterFromBgra` is written
    // against exactly that. Cast rather than work around a typo upstream.
    const bitmap = scaled.getBitmap() as unknown as Buffer

    return rasterFromBgra(bitmap, scaledSize.width, scaledSize.height)
  } catch (error) {
    // The caller has a fallback, so this is not fatal — but it must not be
    // invisible either. A shop whose Urdu receipts quietly stopped coming off
    // the thermal head has nothing to send us without this line.
    console.error('[receipt] raster render failed:', error)
    return null
  } finally {
    if (!win.isDestroyed()) win.destroy()
    try {
      fs.unlinkSync(filePath)
    } catch {
      // The temp directory is swept by the OS; a leftover file is not worth
      // failing a print over.
    }
  }
}

/**
 * Pins the document to the roll's physical width and strips the page chrome.
 *
 * In millimetres, deliberately. The templates are written for a driver-rendered
 * page where the print dialog owns the physical size, and `body { width: 72mm }`
 * is them saying how wide the receipt really is. Overriding that with a pixel
 * width — which is what this used to do, using the printer's dot count — throws
 * the scale away and prints every glyph at about half size; the zoom in
 * `renderReceiptRaster` is what turns these millimetres into dots instead.
 *
 * The body's own padding is left alone on purpose: that is the receipt's inner
 * margin, and without it the text runs into the edge of the roll.
 */
function wrapForRaster(html: string, contentMm: number): string {
  const override = `
<style>
  @page { margin: 0 }
  html {
    margin: 0 !important;
    padding: 0 !important;
    width: ${contentMm}mm !important;
    background: #fff !important;
  }
  body {
    margin: 0 !important;
    width: ${contentMm}mm !important;
    background: #fff !important;
  }
  /* Thermal paper is one colour. Anything mid-grey dithers into noise that
     reads as dirt on the receipt, so the whole document is forced to black on
     white and the dither only has to deal with the logo. */
  * {
    color: #000 !important;
    background-color: transparent !important;
    box-shadow: none !important;
  }
  body { -webkit-print-color-adjust: exact }
</style>`

  return html.includes('</head>')
    ? html.replace('</head>', `${override}</head>`)
    : `${override}${html}`
}

/**
 * How tall the receipt actually is, in CSS pixels.
 *
 * Deliberately not `document.documentElement.scrollHeight`: on the root element
 * that value is floored by the viewport, and the viewport here is the offscreen
 * window, which is opened at a guessed height. A 35mm receipt measured that way
 * comes back as the window height, and the extra is blank raster the printer
 * dutifully feeds out — roughly 8cm of thermal paper thrown away on every Urdu
 * sale, on top of the cut feed. The body's own scroll height and the rendered
 * boxes have no such floor.
 */
async function measureHeight(win: BrowserWindow): Promise<number> {
  const measured = await win.webContents.executeJavaScript(
    `(() => {
       const body = document.body
       const root = document.documentElement
       const content = Math.max(
         body ? body.scrollHeight : 0,
         body ? body.getBoundingClientRect().height : 0,
         root ? root.getBoundingClientRect().height : 0,
       )
       // Only if the document measured as nothing at all — an empty or
       // still-blank page — is the viewport-floored value better than zero.
       return Math.ceil(content || (root ? root.scrollHeight : 0))
     })()`,
  )

  const height = Number(measured)
  return Number.isFinite(height) && height > 0 ? height : 1200
}

/**
 * One frame after the resize. `capturePage` on the very next tick returns the
 * pre-resize surface on every platform we ship to.
 *
 * Bounded, because `requestAnimationFrame` is only *usually* delivered to a
 * window that is never shown — a compositor that decides this window is not
 * visible stops sending frames, and the promise then never settles. Unbounded,
 * that hangs the sale: the till sits on "printing" with a customer waiting and
 * no error to show. A frame captured slightly early costs a stale bitmap and
 * one reprint; waiting forever costs the counter.
 */
const REPAINT_TIMEOUT_MS = 2_000

async function settleRepaint(win: BrowserWindow): Promise<void> {
  try {
    await withTimeout(
      win.webContents.executeJavaScript(
        'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))',
      ),
      REPAINT_TIMEOUT_MS,
      'The receipt document did not repaint',
    )
  } catch {
    // Capture anyway — see above.
  }
}

function padToEight(width: number): number {
  return width % 8 === 0 ? width : width + (8 - (width % 8))
}

function writeTempHtml(html: string): string {
  const file = path.join(
    os.tmpdir(),
    `kaarobar-raster-${Date.now()}-${Math.random().toString(16).slice(2)}.html`,
  )
  fs.writeFileSync(file, html, 'utf8')
  return file
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
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

/**
 * A whole sale receipt as ESC/POS bytes, drawn rather than typed.
 *
 * Same HTML the rendered print path uses, so a shop that switches transports
 * gets the same receipt — only the route to the paper changes.
 *
 * Returns `null` if the render fails, leaving the caller to fall back to text.
 * A receipt full of `?` is poor; no receipt at all, with a customer waiting, is
 * worse.
 */
export async function buildSaleReceiptRaster(
  input: ReceiptSaleInput,
  paperWidth: PosPaperWidth,
  template?: PosReceiptTemplate,
): Promise<Buffer | null> {
  const html = await buildSaleReceiptHtml(input, { paper: paperWidth, template })
  const raster = await renderReceiptRaster(html, { paperWidth })
  if (!raster) return null

  const width = usableChars(paperWidth)

  return new EscPosBuilder(width)
    .init()
    .leftMargin(paperLeftMarginDots())
    .printWidth(paperDotWidth(paperWidth))
    .align('center')
    .raster(raster)
    .cut()
    .build()
}
