import { normalizeAppLanguage, toBcp47, type AppLanguage } from '../../shared/languages'

function toDate(iso: string | number | Date): Date | null {
  const d = iso instanceof Date ? iso : new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

const dateTimeOpts: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
}

const dateOpts: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
}

export function formatDateTime(
  iso: string | number | Date,
  lang: AppLanguage | string = 'en',
): string {
  const d = toDate(iso)
  if (!d) return typeof iso === 'string' ? iso : String(iso)
  return d.toLocaleString(toBcp47(normalizeAppLanguage(lang)), dateTimeOpts)
}

export function formatDate(
  iso: string | number | Date,
  lang: AppLanguage | string = 'en',
): string {
  const d = toDate(iso)
  if (!d) return typeof iso === 'string' ? iso : String(iso)
  return d.toLocaleDateString(toBcp47(normalizeAppLanguage(lang)), dateOpts)
}
