/**
 * Minimal ESC/POS encoder.
 *
 * Thermal printers are frequently installed as a *raw* queue, which passes bytes
 * through untouched — anything that is not an ESC/POS control code is printed as
 * a literal character. That is why sending a rendered HTML document to such a
 * queue prints the markup. This module emits the byte protocol directly, so no
 * driver rendering is involved at all.
 *
 * Reference: ESC/POS command set (Epson TM series), the de-facto standard most
 * 58mm/80mm printers implement.
 */

const ESC = 0x1b
const GS = 0x1d
const LF = 0x0a

export type EscPosAlign = 'left' | 'center' | 'right'

/** Characters per line for the common paper widths, at Font A. */
export const CHARS_PER_LINE: Record<string, number> = {
  '58mm': 32,
  '76mm': 42,
  '80mm': 48,
}

/** Font A cell width in dots. Used to convert a character margin into dots. */
export const DOTS_PER_CHAR = 12

/** Blank characters left at each edge so nothing prints into the tear-off area. */
export const EDGE_MARGIN_CHARS = 1

/** Usable columns once the edge margins are reserved. */
export function usableChars(paperWidth: string): number {
  const full = CHARS_PER_LINE[paperWidth] ?? 48
  return Math.max(16, full - EDGE_MARGIN_CHARS * 2)
}

/**
 * Does this text survive CP437 encoding without losing characters?
 *
 * Not the same as encoding unchanged: accented Latin is transliterated ("Especes"
 * for "Espèces") and stays perfectly readable. What matters is whether
 * characters were *dropped* to the '?' substitute, which is what happens to any
 * non-Latin script. Callers use this to choose content the print head can render
 * rather than handing over text that degrades into a row of '?'.
 */
export function isCp437Printable(value: string): boolean {
  return countQuestionMarks(toCp437(value)) === countQuestionMarks(value)
}

function countQuestionMarks(value: string): number {
  let n = 0
  for (const ch of value) if (ch === '?') n += 1
  return n
}

/**
 * Does any text anywhere in this value need characters CP437 cannot print?
 *
 * Walks strings, arrays and plain objects, so a receipt field added later is
 * covered without anybody remembering to list it here. Used to decide whether
 * a receipt has to be rastered rather than sent as text — see
 * `renderReceiptRaster.ts`.
 */
export function containsUnprintable(value: unknown): boolean {
  if (typeof value === 'string') return !isCp437Printable(value)
  if (Array.isArray(value)) return value.some(containsUnprintable)

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some(containsUnprintable)
  }

  return false
}

export class EscPosBuilder {
  private chunks: Buffer[] = []

  constructor(private readonly width = 48) {}

  private push(...bytes: number[]): this {
    this.chunks.push(Buffer.from(bytes))
    return this
  }

  /** ESC @ — reset to power-on defaults. */
  init(): this {
    return this.push(ESC, 0x40)
  }

  /**
   * GS L — left margin, in dots. Shifts the print area away from the left edge;
   * some printers otherwise start at dot 0 and clip the first column.
   */
  leftMargin(dots: number): this {
    return this.push(GS, 0x4c, dots & 0xff, (dots >> 8) & 0xff)
  }

  /** GS W — print area width, in dots. Keeps the right edge off the tear line. */
  printWidth(dots: number): this {
    return this.push(GS, 0x57, dots & 0xff, (dots >> 8) & 0xff)
  }

  /** ESC a n */
  align(mode: EscPosAlign): this {
    const n = mode === 'center' ? 1 : mode === 'right' ? 2 : 0
    return this.push(ESC, 0x61, n)
  }

  /** ESC E n */
  bold(on: boolean): this {
    return this.push(ESC, 0x45, on ? 1 : 0)
  }

  /** GS ! n — width/height multipliers (0–7 each). */
  size(w: 0 | 1, h: 0 | 1): this {
    return this.push(GS, 0x21, (w << 4) | h)
  }

  /**
   * Text. Encoded as CP437, the default code page on virtually all ESC/POS
   * printers — UTF-8 multi-byte sequences would otherwise print as mojibake.
   */
  text(value: string): this {
    this.chunks.push(Buffer.from(toCp437(value), 'binary'))
    return this
  }

  line(value = ''): this {
    return this.text(value).push(LF)
  }

  /**
   * Label left, value right, padded to the paper width. With a leader char the
   * gap is filled dot-leader style (`Item ..... 12.00`) when it is wide enough.
   */
  pair(label: string, value: string, leader?: string | null): this {
    const gap = Math.max(1, this.width - label.length - value.length)
    const fill = leader && gap >= 3 ? ` ${leader.repeat(gap - 2)} ` : ' '.repeat(gap)
    return this.line(label + fill + value)
  }

  rule(char = '-'): this {
    return this.line(char.repeat(this.width))
  }

  feed(lines = 1): this {
    return this.push(ESC, 0x64, lines)
  }

  /**
   * GS k m n d1..dn — CODE128 (code set B), same symbology as the HTML receipt.
   *
   * CODE128 over CODE39 because density decides whether the barcode prints at
   * all: printers refuse (or clip) a symbol wider than the print area, and a
   * 14-char invoice number in CODE39 needs ~450 dots — wider than a 58mm roll.
   * The module width is chosen to fit this builder's paper width, and if even
   * the narrowest module cannot fit, the barcode is skipped rather than letting
   * the printer mangle it.
   */
  barcode(value: string): this {
    // Code set B covers printable ASCII. '{' is the ESC/POS escape inside
    // CODE128 data, so it must be doubled.
    const clean = value
      .split('')
      .filter((ch) => {
        const code = ch.charCodeAt(0)
        return code >= 0x20 && code <= 0x7e
      })
      .join('')
      .slice(0, 32)
      .replace(/\{/g, '{{')
    if (!clean) return this

    // Symbol width: 11 modules per char + start/checksum (11 each) + stop (13).
    // '{{' counts as one encoded char, so measure after collapsing the escape.
    const dataChars = clean.replace(/\{\{/g, '{').length
    const modules = 11 * (dataChars + 2) + 13
    const printableDots = this.width * DOTS_PER_CHAR
    const moduleWidth = modules * 2 <= printableDots ? 2 : modules <= printableDots ? 1 : 0
    if (moduleWidth === 0) return this

    const payload = `{B${clean}`
    this.push(GS, 0x68, 60) // height
    this.push(GS, 0x77, moduleWidth) // module width
    this.push(GS, 0x48, 2) // HRI below barcode
    this.push(GS, 0x6b, 73, payload.length) // CODE128, explicit length
    this.chunks.push(Buffer.from(payload, 'binary'))
    return this
  }

  /** Append a pre-encoded raster image (see escposImage.ts). */
  raster(bytes: Buffer | null): this {
    if (bytes && bytes.length) this.chunks.push(bytes)
    return this
  }

  /** GS V — full/partial cut, after feeding the paper clear of the head. */
  cut(): this {
    return this.feed(4).push(GS, 0x56, 66, 0)
  }

  build(): Buffer {
    return Buffer.concat(this.chunks)
  }
}

/**
 * Best-effort CP437 mapping. Accented Latin characters are transliterated; any
 * codepoint with no CP437 equivalent (Urdu/Arabic, for example) becomes '?' so
 * the receipt stays readable rather than emitting random glyphs.
 */
const TRANSLITERATE: Record<string, string> = {
  '·': '-', // middle dot
  '•': '-', // bullet
  '–': '-', // en dash
  '—': '-', // em dash
  '‘': "'", '’': "'",
  '“': '"', '”': '"',
  '×': 'x', // multiplication sign
  '…': '...',
  ' ': ' ',
}

function toCp437(value: string): string {
  let out = ''
  for (const ch of value.normalize('NFKD')) {
    const mapped = TRANSLITERATE[ch]
    if (mapped !== undefined) {
      out += mapped
      continue
    }
    const code = ch.codePointAt(0) ?? 63
    if (code < 0x80) {
      out += ch
    } else if (code >= 0x300 && code <= 0x36f) {
      // Combining diacritic left over from NFKD — drop it.
      continue
    } else {
      out += '?'
    }
  }
  return out
}
