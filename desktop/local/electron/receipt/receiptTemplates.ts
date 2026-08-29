import type { PosReceiptTemplate } from './posPrinterSettings'

/**
 * Visual styles for the selectable receipt templates.
 *
 * A template never changes what a receipt says or the order of its sections —
 * both document layouts (buildSaleReceiptHtml) and the ESC/POS composer
 * (buildSaleReceiptEscPos) keep one structure and consume these registries for
 * the styling differences: dividers, fonts, emphasis. That is what keeps the
 * three transports in sync per template.
 */

export type TemplateCssCtx = {
  dir: 'ltr' | 'rtl'
  brandHex: string
  /** Printable content width of the document, in mm. */
  contentMm: number
}

/**
 * CSS every printable document must carry.
 *
 * Two things Chromium gets wrong for us by default:
 *
 * `@page { margin: 0 }` — without it the print engine adds its own page margin
 * (~10mm a side) *on top of* the body padding the layout already sets. On A4
 * that is merely too much whitespace; on a 72mm roll it leaves ~52mm of usable
 * width for a document laid out at 72mm, so every row wraps and the right-hand
 * column is cut off. That is the single biggest cause of a receipt printing
 * "broken" while looking correct in the preview window.
 *
 * `print-color-adjust: exact` — Chromium drops background fills when printing
 * unless asked not to. The silent transport passes `printBackground: true`, but
 * the preview window prints through the OS dialog, where "Background graphics"
 * is off by default. Without this the banded headers, boxed totals and shaded
 * table heads print as blank white space and the layout falls apart.
 */
export const PRINT_PAGE_RESET_CSS = `
    @page { margin: 0; }
    html, body {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @media print {
      html, body { margin: 0 !important; }
    }`

/**
 * A run of characters long enough to span the paper, whatever its width.
 *
 * Character dividers used to be a hard-coded 32 characters, which fitted only
 * 80mm paper: 58mm rolls overflowed and clipped mid-pattern, 76mm left a gap at
 * both ends. This deliberately over-generates and lets the divider's
 * `overflow: hidden` trim the excess — because the elements are centred, a
 * repeating pattern clips symmetrically and reads as a full-width rule.
 *
 * `mmPerChar` is the advance width of one character at the divider's own font
 * size and letter-spacing, which differs per template.
 */
function fillChars(pattern: string, contentMm: number, mmPerChar: number): string {
  const needed = Math.ceil(contentMm / Math.max(mmPerChar, 0.1) / pattern.length) + 2
  return pattern.repeat(Math.max(needed, 4))
}

export type HtmlTemplateStyle = {
  /**
   * Font override for LTR documents only. RTL always keeps the Arabic-capable
   * stack from printDocumentChrome — Courier and friends have no Arabic glyphs.
   */
  fontFamilyLtr?: string
  /**
   * Self-contained divider element used by the roll layout.
   *
   * A function rather than a string because character-based dividers have to
   * know how wide the paper is; see `fillChars`.
   */
  rollDividerHtml: (ctx: TemplateCssCtx) => string
  /** Appended after the base CSS of the roll <style>; later rules win. */
  rollCss: (ctx: TemplateCssCtx) => string
  /** Appended after the base CSS of the sheet (A4/Letter) <style>. */
  sheetCss: (ctx: TemplateCssCtx) => string
  /** Wrap the shop name + contact lines in a filled band (logo stays outside). */
  bannerHeader: boolean
  /** Wrap the grand-total row in a bordered box. */
  boxedTotal: boolean
  /** Fill the gap of label/value rows with a dotted leader. */
  dotLeaders: boolean
}

export type EscPosTemplateStyle = {
  /** ASCII pattern the divider line repeats (usually one char, e.g. `\/`). */
  dividerChar: string
  /** Leader character for label/value pairs; null = plain space fill. */
  pairLeader: string | null
  /** Print a divider directly above and below the TOTAL pair. */
  boxTotal: boolean
}

/**
 * Text color that stays readable on a solid fill of the given hex, by YIQ
 * luminance. Used for the sheet layout's brand-colored header band, where the
 * brand color can be anything from near-white to near-black.
 */
export function yiqText(hex: string): string {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match) return '#ffffff'
  const value = parseInt(match[1], 16)
  const r = (value >> 16) & 0xff
  const g = (value >> 8) & 0xff
  const b = value & 0xff
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#111111' : '#ffffff'
}

/** Advance width of one character in the `.stars` divider, at 11px + 1px tracking. */
const STARS_MM_PER_CHAR = 1.7

const charDivider = (pattern: string, mmPerChar: number, className = 'stars') =>
  ({ contentMm }: TemplateCssCtx) =>
    `<div class="${className}">${fillChars(pattern, contentMm, mmPerChar)}</div>`

const HTML_STYLES: Record<PosReceiptTemplate, HtmlTemplateStyle> = {
  // The default look: a plain hairline rule between sections.
  //
  // This used to draw its dividers as a row of asterisks, which is why an
  // out-of-the-box receipt printed rows of `*` where a line belonged. A rule is
  // what the other nineteen templates draw and what people expect a divider to
  // look like; the character dividers below are kept only where they are the
  // point of the template (mono's typewriter `=`, ticket's tear-off line).
  classic: {
    rollDividerHtml: () => '<div class="hr-cl"></div>',
    rollCss: () => `
    .hr-cl { border-top: 1px solid #555; margin: 10px 0; }`,
    sheetCss: () => '',
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Clean and airy: thin dashed rules, small tracked-out title.
  minimal: {
    rollDividerHtml: () => '<div class="hr"></div>',
    rollCss: ({ dir }) => `
    .hr { border-top: 1px dashed #999; margin: 10px 0; }
    .shop { font-weight: 600; }
    .title { font-size: 12px; font-weight: 600; ${dir === 'ltr' ? 'text-transform: uppercase; letter-spacing: 2px;' : ''} }
    .row { margin: 3px 0; }`,
    sheetCss: () => `
    .head { border-bottom: 1px dashed #bbb; }
    th { background: transparent; border-bottom: 1px dashed #999; }
    .sum-row.grand { border-top: 1px dashed #999; border-bottom: 1px dashed #999; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Cash-receipt style: dotted rules and dot leaders between label and value.
  dotted: {
    rollDividerHtml: () => '<div class="hr"></div>',
    rollCss: () => `
    .hr { border-top: 2px dotted #444; margin: 9px 0; }
    .row .leader { flex: 1 1 auto; border-bottom: 1px dotted #555; margin: 0 3px 3px; min-width: 8px; }`,
    sheetCss: () => `
    th { background: transparent; border-bottom: 2px dotted #666; }
    td { border-bottom: 1px dotted #aaa; }
    .sum-row.grand { border-top: 2px dotted #666; border-bottom: 2px dotted #666; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: true,
  },

  // Retro typewriter: monospace stack, '=' dividers, uppercase headings.
  mono: {
    fontFamilyLtr: "'Courier New', Consolas, 'Liberation Mono', monospace",
    rollDividerHtml: charDivider('=', STARS_MM_PER_CHAR),
    rollCss: ({ dir }) =>
      dir === 'ltr' ? `
    .shop, .title, .thanks { text-transform: uppercase; }` : '',
    sheetCss: ({ dir }) => `
    th { background: transparent; border-bottom: 3px double #333; }
    ${dir === 'ltr' ? '.shop, .doc-title { text-transform: uppercase; }' : ''}`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Branded and heavy: filled header band, thick rules, boxed grand total.
  // The roll band is near-black rather than the brand color — thermal printers
  // dither color fills into muddy gray, and solid black prints crisp.
  bold: {
    rollDividerHtml: () => '<div class="hr-heavy"></div>',
    rollCss: () => `
    .hr-heavy { border-top: 2.5px solid #111; margin: 9px 0; }
    .band { background: #111; color: #fff; padding: 6px 4px; margin: 6px 0 4px; border-radius: 3px; }
    .band .muted { color: #eee; }
    .total-box { border: 2px solid #111; padding: 4px 7px; margin: 6px 0; }
    .total-box .row.total { margin: 0; }`,
    sheetCss: ({ brandHex }) => {
      const text = yiqText(brandHex)
      return `
    .head.head-band { background: ${brandHex}; color: ${text}; padding: 14px 16px; border-radius: 6px; border-bottom: none; }
    .head.head-band .muted, .head.head-band .meta-label { color: ${text}; opacity: 0.85; }
    .sum-row.grand { border: 2px solid #111; background: #f3f4f6; }`
    },
    bannerHeader: true,
    boxedTotal: true,
    dotLeaders: false,
  },

  // Formal serif: hairline rules, underlined title, italic thank-you.
  elegant: {
    fontFamilyLtr: "Georgia, 'Times New Roman', 'Noto Serif', serif",
    rollDividerHtml: () => '<div class="hr-el"></div>',
    rollCss: ({ dir }) => `
    .hr-el { border-top: 1px solid #333; margin: 10px 0; }
    .title { text-decoration: underline; text-underline-offset: 3px; ${dir === 'ltr' ? 'letter-spacing: 1px;' : ''} }
    .thanks { font-style: italic; font-weight: 600; }`,
    sheetCss: () => `
    th { background: transparent; border-top: 1px solid #333; border-bottom: 1px solid #333; }
    .doc-title { text-decoration: underline; text-underline-offset: 3px; }
    .thanks { font-style: italic; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Full grid: bordered items table, ruled sections, boxed grand total.
  boxed: {
    rollDividerHtml: () => '<div class="hr-bx"></div>',
    rollCss: () => `
    .hr-bx { border-top: 1.5px solid #111; margin: 10px 0; }
    table { border: 1.5px solid #111; }
    th, td { border: 1px solid #444; padding: 4px 3px; }
    th { background: #eee; }
    .total-box { border: 1.5px solid #111; padding: 5px 7px; margin: 7px 0; }
    .total-box .row.total { margin: 0; }`,
    sheetCss: () => `
    table { border: 1.5px solid #333; }
    th, td { border: 1px solid #c7cbd1; }
    .sum-row.grand { border: 1.5px solid #333; }`,
    bannerHeader: false,
    boxedTotal: true,
    dotLeaders: false,
  },

  // High contrast: the receipt title sits on a dark strip, thick solid rules.
  stripe: {
    rollDividerHtml: () => '<div class="hr-st"></div>',
    rollCss: ({ dir }) => `
    .hr-st { border-top: 3px solid #111; margin: 10px 0; }
    .title { background: #111; color: #fff; padding: 4px 6px; ${dir === 'ltr' ? 'text-transform: uppercase; letter-spacing: 2px;' : ''} }`,
    sheetCss: ({ dir }) => `
    .doc-title { background: #111; color: #fff; padding: 4px 10px; display: inline-block; ${dir === 'ltr' ? 'text-transform: uppercase; letter-spacing: 1px;' : ''} }
    th { background: #111; color: #fff; border-bottom: none; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Airy and modern: no ruled dividers at all — soft gray rounded panels
  // carry the title and totals, everything else floats on whitespace.
  soft: {
    rollDividerHtml: () => '<div class="sp"></div>',
    rollCss: () => `
    .sp { height: 9px; }
    .title { background: #f1f2f4; border-radius: 6px; padding: 5px 6px; }
    th { border-bottom: 1px solid #e2e4e8; }
    .total-box { background: #f1f2f4; border-radius: 6px; padding: 6px 8px; margin: 8px 0; }
    .total-box .row.total { margin: 0; }`,
    sheetCss: () => `
    .head { border-bottom: none; background: #f7f8f9; padding: 16px; border-radius: 10px; }
    th { background: #f1f2f4; border-bottom: none; }
    .sum-row.grand { background: #f1f2f4; border: none; border-radius: 6px; }`,
    bannerHeader: false,
    boxedTotal: true,
    dotLeaders: false,
  },

  // Boutique: handwritten-style shop name, dainty spaced-dot dividers.
  script: {
    rollDividerHtml: charDivider('·', 3.1, 'dots-sm'),
    rollCss: ({ dir }) => `
    .dots-sm { text-align: center; font-size: 10px; letter-spacing: 6px; margin: 10px 0; overflow: hidden; white-space: nowrap; color: #666; }
    ${dir === 'ltr' ? ".shop { font-family: 'Segoe Script', 'Brush Script MT', cursive; font-size: 20px; font-weight: 400; }" : ''}
    .thanks { font-style: italic; }`,
    sheetCss: ({ dir }) => `
    ${dir === 'ltr' ? ".shop { font-family: 'Segoe Script', 'Brush Script MT', cursive; font-size: 26px; font-weight: 400; }" : ''}
    th { background: transparent; border-bottom: 1px dotted #888; }
    .sum-row.grand { border-top: 1px dotted #888; border-bottom: 1px dotted #888; }
    .thanks { font-style: italic; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Accent: the business's brand color carries the dividers, title and total.
  // Thermal printing renders the color as gray; driver prints and previews
  // show it in full color.
  accent: {
    rollDividerHtml: () => '<div class="hr-acc"></div>',
    rollCss: ({ brandHex }) => `
    .hr-acc { border-top: 2px solid ${brandHex}; margin: 10px 0; }
    .shop { color: ${brandHex}; }
    .title { color: ${brandHex}; }
    .row.total { color: ${brandHex}; }`,
    sheetCss: ({ brandHex }) => `
    th { background: ${brandHex}; color: ${yiqText(brandHex)}; border-bottom: none; }
    .doc-title { color: ${brandHex}; }
    .sum-row.grand { border-color: ${brandHex}; color: ${brandHex}; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Framed: the whole receipt sits inside a delicate rounded border.
  framed: {
    rollDividerHtml: () => '<div class="hr-fr"></div>',
    rollCss: () => `
    .wrap { border: 1.5px solid #333; border-radius: 10px; padding: 9px 7px; }
    .hr-fr { border-top: 1px solid #aaa; margin: 9px 0; }`,
    sheetCss: () => `
    body { border: 1.5px solid #333; border-radius: 12px; padding: 10mm 8mm; }
    th { background: transparent; border-bottom: 1px solid #aaa; }
    .sum-row.grand { border-top: 1.5px solid #333; border-bottom: 1.5px solid #333; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Two-tone: zebra-striped item rows and an inverted (dark) grand total.
  duo: {
    rollDividerHtml: () => '<div class="hr-duo"></div>',
    rollCss: () => `
    .hr-duo { border-top: 2px solid #111; margin: 10px 0; }
    tbody tr:nth-child(even) td { background: #f0f1f3; }
    .total-box { background: #111; color: #fff; border-radius: 4px; padding: 6px 8px; margin: 8px 0; }
    .total-box .row.total { margin: 0; }`,
    sheetCss: () => `
    tbody tr:nth-child(even) td { background: #f5f6f8; }
    .sum-row.grand { background: #111; color: #fff; border: none; }`,
    bannerHeader: false,
    boxedTotal: true,
    dotLeaders: false,
  },

  // Vintage: old-print feel — double rules, small-caps headings, book serif.
  vintage: {
    fontFamilyLtr: "'Book Antiqua', Palatino, 'Palatino Linotype', Georgia, serif",
    rollDividerHtml: () => '<div class="hr-vt"></div>',
    rollCss: () => `
    .hr-vt { border-top: 4px double #333; margin: 10px 0; }
    .shop, .title { font-variant: small-caps; }`,
    sheetCss: () => `
    th { background: transparent; border-top: 4px double #333; border-bottom: 4px double #333; }
    .doc-title { font-variant: small-caps; }
    .sum-row.grand { border-top: 4px double #333; border-bottom: 4px double #333; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Event ticket: scissor tear-lines, dashed side edges, pill-shaped title.
  ticket: {
    rollDividerHtml: ({ contentMm }) =>
      `<div class="tear">8&lt;${fillChars(' -', contentMm, 2.1)}</div>`,
    rollCss: ({ dir }) => `
    .tear { text-align: center; font-size: 10px; letter-spacing: 2px; margin: 10px 0; overflow: hidden; white-space: nowrap; color: #555; }
    .wrap { border-inline: 1.5px dashed #999; padding-inline: 6px; }
    .title { border: 1.5px dashed #333; border-radius: 999px; padding: 4px 12px; display: inline-block; ${dir === 'ltr' ? 'text-transform: uppercase; letter-spacing: 2px;' : ''} }`,
    sheetCss: ({ dir }) => `
    .doc-title { border: 1.5px dashed #333; border-radius: 999px; padding: 4px 14px; display: inline-block; ${dir === 'ltr' ? 'text-transform: uppercase; letter-spacing: 1px;' : ''} }
    th { background: transparent; border-bottom: 1.5px dashed #666; }
    .sum-row.grand { border-top: 1.5px dashed #666; border-bottom: 1.5px dashed #666; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Ledger book: a brand-colored margin line and faint baselines under rows.
  ledger: {
    rollDividerHtml: () => '<div class="hr-lg"></div>',
    rollCss: ({ brandHex }) => `
    .hr-lg { border-top: 1px solid #999; margin: 9px 0; }
    .wrap { border-inline-start: 2px solid ${brandHex}; padding-inline-start: 7px; }
    .row { border-bottom: 1px solid #ececec; padding-bottom: 3px; }
    td { border-bottom: 1px solid #ececec; }`,
    sheetCss: ({ brandHex }) => `
    body { border-inline-start: 3px solid ${brandHex}; }
    .head { border-bottom: 3px double #333; }
    td { border-bottom: 1px solid #e5e7eb; }
    .sum-row { border-bottom: 1px solid #ececec; }
    .sum-row.grand { border-top: 1px solid #333; border-bottom: 3px double #333; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Deluxe: double picture-frame border, small-caps, diamond chain dividers.
  deluxe: {
    rollDividerHtml: charDivider('&lt;&gt;', STARS_MM_PER_CHAR),
    rollCss: ({ dir }) => `
    .wrap { border: 1px solid #333; outline: 1px solid #333; outline-offset: 3px; padding: 9px 7px; margin: 4px; }
    .shop { font-variant: small-caps; ${dir === 'ltr' ? 'letter-spacing: 1px;' : ''} }
    .title { font-variant: small-caps; }`,
    sheetCss: () => `
    body { border: 1px solid #333; outline: 1px solid #333; outline-offset: 4px; padding: 10mm 8mm; }
    .doc-title { font-variant: small-caps; }
    th { background: transparent; border-top: 1px solid #333; border-bottom: 1px solid #333; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Wave: relaxed squiggle dividers with italic headings.
  wave: {
    rollDividerHtml: charDivider('~', 3.4, 'wave-hr'),
    rollCss: () => `
    .wave-hr { text-align: center; font-size: 13px; letter-spacing: 3px; margin: 8px 0; overflow: hidden; white-space: nowrap; color: #444; }
    .title { font-style: italic; }
    .thanks { font-style: italic; }`,
    sheetCss: () => `
    th { background: transparent; border-bottom: 2px solid #666; }
    .doc-title { font-style: italic; }
    .thanks { font-style: italic; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Market stall: rustic morse dividers and a hand-stamped tilted title.
  market: {
    rollDividerHtml: charDivider('-.', STARS_MM_PER_CHAR),
    rollCss: () => `
    .title { border: 1.5px dashed #444; padding: 4px 10px; display: inline-block; transform: rotate(-1.5deg); }
    .thanks { letter-spacing: 1px; }`,
    sheetCss: () => `
    .doc-title { border: 1.5px dashed #444; padding: 4px 12px; display: inline-block; transform: rotate(-1.5deg); }
    th { background: transparent; border-top: 1.5px dashed #666; border-bottom: 1.5px dashed #666; }
    .sum-row.grand { border-top: 1.5px dashed #666; border-bottom: 1.5px dashed #666; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },

  // Regal: accounting thin-over-thick rules with a formal serif.
  regal: {
    fontFamilyLtr: "Cambria, 'Palatino Linotype', Georgia, serif",
    rollDividerHtml: () => '<div class="hr-rgl"></div>',
    rollCss: ({ dir }) => `
    .hr-rgl { border-top: 1px solid #333; border-bottom: 3px solid #333; height: 2px; margin: 10px 0; }
    .shop { font-variant: small-caps; }
    .title { font-variant: small-caps; ${dir === 'ltr' ? 'letter-spacing: 2px;' : ''} }
    .row.total { border-top: 1px solid #333; border-bottom: 3px solid #333; padding: 4px 0; }`,
    sheetCss: () => `
    th { background: transparent; border-top: 1px solid #333; border-bottom: 3px solid #333; }
    .doc-title { font-variant: small-caps; }
    .sum-row.grand { border-top: 1px solid #333; border-bottom: 3px double #333; }`,
    bannerHeader: false,
    boxedTotal: false,
    dotLeaders: false,
  },
}

// Every character here must survive CP437 — plain ASCII by construction.
const ESCPOS_STYLES: Record<PosReceiptTemplate, EscPosTemplateStyle> = {
  // '-' rather than '*': on the thermal path a divider can only be characters,
  // and a run of hyphens reads as the rule it stands in for. Stars read as
  // stars.
  classic: { dividerChar: '-', pairLeader: null, boxTotal: false },
  minimal: { dividerChar: '-', pairLeader: null, boxTotal: false },
  dotted: { dividerChar: '.', pairLeader: '.', boxTotal: false },
  mono: { dividerChar: '=', pairLeader: null, boxTotal: false },
  bold: { dividerChar: '#', pairLeader: null, boxTotal: true },
  elegant: { dividerChar: '~', pairLeader: null, boxTotal: false },
  boxed: { dividerChar: '+', pairLeader: null, boxTotal: true },
  stripe: { dividerChar: '_', pairLeader: null, boxTotal: false },
  soft: { dividerChar: ' ', pairLeader: null, boxTotal: false },
  script: { dividerChar: ':', pairLeader: null, boxTotal: false },
  accent: { dividerChar: '-', pairLeader: null, boxTotal: false },
  framed: { dividerChar: '-', pairLeader: null, boxTotal: false },
  duo: { dividerChar: '=', pairLeader: null, boxTotal: true },
  vintage: { dividerChar: '=', pairLeader: null, boxTotal: false },
  ticket: { dividerChar: '- ', pairLeader: null, boxTotal: false },
  ledger: { dividerChar: '-', pairLeader: null, boxTotal: false },
  deluxe: { dividerChar: '<>', pairLeader: null, boxTotal: false },
  wave: { dividerChar: '~', pairLeader: null, boxTotal: false },
  market: { dividerChar: '-.', pairLeader: null, boxTotal: false },
  regal: { dividerChar: '=-', pairLeader: null, boxTotal: true },
}

export function htmlTemplateStyle(template: PosReceiptTemplate): HtmlTemplateStyle {
  return HTML_STYLES[template] ?? HTML_STYLES.classic
}

export function escposTemplateStyle(template: PosReceiptTemplate): EscPosTemplateStyle {
  return ESCPOS_STYLES[template] ?? ESCPOS_STYLES.classic
}
