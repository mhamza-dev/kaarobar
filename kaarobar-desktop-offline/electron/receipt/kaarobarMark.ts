import { COMPANY_NAME, DEFAULT_BRAND_HEX, PRODUCT_NAME } from '../../shared/branding'
import type { AppLanguage } from '../../shared/languages'

const HEX_RE = /^#([0-9a-fA-F]{6})$/

/** Normalize shop brand hex for print markup; fall back to Kaarobar blue. */
export function resolvePrintBrandHex(hex: string | null | undefined): string {
  const value = (hex ?? '').trim()
  if (HEX_RE.test(value)) return value.toLowerCase()
  return DEFAULT_BRAND_HEX
}

/**
 * Kaarobar network mark as a data URL.
 * Background fill follows the shop brand color; white mark stays white.
 */
export function kaarobarMarkDataUrl(brandHex?: string | null): string {
  const fill = resolvePrintBrandHex(brandHex)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="128" height="128" role="img" aria-label="${PRODUCT_NAME}">
  <rect width="1024" height="1024" rx="180" fill="${fill}"/>
  <g fill="none" stroke="#ffffff" stroke-width="44" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 270 512 L 478 512"/>
    <path d="M 390 230 L 390 410 Q 390 512 478 512"/>
    <path d="M 390 794 L 390 614 Q 390 512 478 512"/>
  </g>
  <g fill="#ffffff">
    <circle cx="270" cy="512" r="75"/>
    <circle cx="390" cy="230" r="75"/>
    <circle cx="390" cy="794" r="75"/>
    <circle cx="478" cy="512" r="46"/>
  </g>
  <g fill="#ffffff">
    <g transform="translate(582, 408) rotate(-45)">
      <path d="M 0,-75 L 250,-75 A 35 35 0 0 1 285,-40 L 285,40 A 35 35 0 0 1 250,75 L 0,75 A 75 75 0 0 1 0,-75 Z"/>
    </g>
    <g transform="translate(582, 616) rotate(45)">
      <path d="M 0,-75 L 250,-75 A 35 35 0 0 1 285,-40 L 285,40 A 35 35 0 0 1 250,75 L 0,75 A 75 75 0 0 1 0,-75 Z"/>
    </g>
  </g>
</svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

const POWERED_BY: Record<AppLanguage, string> = {
  en: `Powered by ${PRODUCT_NAME} POS · ${COMPANY_NAME}`,
  ur: `${PRODUCT_NAME} POS · ${COMPANY_NAME} سے تقویت یافتہ`,
  de: `Bereitgestellt von ${PRODUCT_NAME} POS · ${COMPANY_NAME}`,
  pt: `Desenvolvido por ${PRODUCT_NAME} POS · ${COMPANY_NAME}`,
  es: `Desarrollado por ${PRODUCT_NAME} POS · ${COMPANY_NAME}`,
  fr: `Propulsé par ${PRODUCT_NAME} POS · ${COMPANY_NAME}`,
  ar: `مدعوم من ${PRODUCT_NAME} POS · ${COMPANY_NAME}`,
}

/** Kept for callers that need a composed powered-by line. */
export function printPoweredByLabel(lang: AppLanguage): string {
  return POWERED_BY[lang] ?? POWERED_BY.en
}
