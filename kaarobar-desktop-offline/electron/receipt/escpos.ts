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

  /** Label left, value right, padded to the paper width. */
  pair(label: string, value: string): this {
    const gap = Math.max(1, this.width - label.length - value.length)
    return this.line(label + ' '.repeat(gap) + value)
  }

  rule(char = '-'): this {
    return this.line(char.repeat(this.width))
  }

  feed(lines = 1): this {
    return this.push(ESC, 0x64, lines)
  }

  /** GS k m n d1..dn — CODE39, widely supported and alphanumeric. */
  barcode(value: string): this {
    const clean = value.replace(/[^0-9A-Z\-. $/+%]/gi, '').toUpperCase().slice(0, 20)
    if (!clean) return this
    this.push(GS, 0x68, 60) // height
    this.push(GS, 0x77, 2) // module width
    this.push(GS, 0x48, 2) // HRI below barcode
    this.push(GS, 0x6b, 69, clean.length) // CODE39, explicit length
    this.chunks.push(Buffer.from(clean, 'binary'))
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
function toCp437(value: string): string {
  let out = ''
  for (const ch of value.normalize('NFKD')) {
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
