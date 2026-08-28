/** Curated ISO 4217 codes for Kaarobar business markets. */
export const CURRENCY_CODES = [
  'PKR',
  'USD',
  'EUR',
  'GBP',
  'AED',
  'SAR',
  'INR',
  'BRL',
  'TRY',
  'IDR',
  'MXN',
  'CAD',
  'AUD',
  'QAR',
  'KWD',
  'EGP',
  'MYR',
  'SGD',
] as const

export type CurrencyCode = (typeof CURRENCY_CODES)[number]

export type CurrencyOption = {
  value: string
  label: string
}

const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  PKR: 'Pakistani Rupee',
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  AED: 'UAE Dirham',
  SAR: 'Saudi Riyal',
  INR: 'Indian Rupee',
  BRL: 'Brazilian Real',
  TRY: 'Turkish Lira',
  IDR: 'Indonesian Rupiah',
  MXN: 'Mexican Peso',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  QAR: 'Qatari Riyal',
  KWD: 'Kuwaiti Dinar',
  EGP: 'Egyptian Pound',
  MYR: 'Malaysian Ringgit',
  SGD: 'Singapore Dollar',
}

export const CURRENCY_OPTIONS: CurrencyOption[] = CURRENCY_CODES.map((code) => ({
  value: code,
  label: `${code} — ${CURRENCY_NAMES[code]}`,
}))

export function isCurrencyCode(value: string): value is CurrencyCode {
  return (CURRENCY_CODES as readonly string[]).includes(value)
}

/** Options for a select; appends an unknown saved code so it stays selectable. */
export function currencyOptionsForValue(current?: string | null): CurrencyOption[] {
  const code = (current ?? '').trim().toUpperCase()
  if (!code || isCurrencyCode(code)) return CURRENCY_OPTIONS
  return [...CURRENCY_OPTIONS, { value: code, label: `${code} — Custom` }]
}

/** Allowed codes for Yup `oneOf`, including an optional legacy/saved value. */
export function allowedCurrencyCodes(extra?: string | null): string[] {
  const code = (extra ?? '').trim().toUpperCase()
  if (!code || isCurrencyCode(code)) return [...CURRENCY_CODES]
  return [...CURRENCY_CODES, code]
}

/** Short display sign/prefix for UI and receipts. */
const CURRENCY_PREFIX: Record<string, string> = {
  PKR: 'Rs',
  RS: 'Rs',
  USD: '$',
  EUR: '€',
  GBP: '£',
  AED: 'د.إ',
  SAR: '﷼',
  INR: '₹',
  BRL: 'R$',
  TRY: '₺',
  IDR: 'Rp',
  MXN: 'MX$',
  CAD: 'CA$',
  AUD: 'A$',
  QAR: 'QR',
  KWD: 'KD',
  EGP: 'E£',
  MYR: 'RM',
  SGD: 'S$',
}

export function currencyPrefix(currency?: string | null): string {
  const code = (currency || 'PKR').trim().toUpperCase()
  return CURRENCY_PREFIX[code] ?? code
}
