/**
 * Social link normalization shared by the Business Settings form and the
 * receipt preview: the form stores bare handles/phones, the database and the
 * receipt QR codes want full URLs.
 */

export type SocialLinkType = 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'website'

const ensureHttps = (value: string) => {
  if (/^https?:\/\//i.test(value)) return value
  return `https://${value}`
}

const normalizeWhatsapp = (input: string) => {
  const digits = input.replace(/\D+/g, '')
  if (digits) return `https://wa.me/${digits}`
  return ensureHttps(input)
}

const normalizeSocialHandle = (
  input: string,
  baseUrl: string,
  { keepAt = false }: { keepAt?: boolean } = {},
) => {
  if (/^https?:\/\//i.test(input)) return input
  if (/^[\w.-]+\.[a-z]{2,}/i.test(input)) return ensureHttps(input)
  const clean = input.replace(/^@+/, '').replace(/^\/+|\/+$/g, '')
  if (!clean) return null
  return `${baseUrl}${keepAt ? `@${clean}` : clean}`
}

export const normalizeSocialLink = (input: string, type: SocialLinkType) => {
  const value = input.trim()
  if (!value) return null
  switch (type) {
    case 'whatsapp':
      return normalizeWhatsapp(value)
    case 'instagram':
      return normalizeSocialHandle(value, 'https://instagram.com/')
    case 'facebook':
      return normalizeSocialHandle(value, 'https://facebook.com/')
    case 'tiktok':
      return normalizeSocialHandle(value, 'https://tiktok.com/', { keepAt: true })
    case 'website':
      return ensureHttps(value)
    default:
      return value
  }
}

/** Strip stored absolute URLs so the form shows handle / phone / domain only. */
export const denormalizeSocialLink = (
  input: string | null | undefined,
  type: SocialLinkType,
): string => {
  const value = (input ?? '').trim()
  if (!value) return ''

  try {
    if (type === 'whatsapp') {
      const digits = value.replace(/\D+/g, '')
      return digits || value
    }

    if (type === 'website') {
      return value.replace(/^https?:\/\//i, '').replace(/\/+$/, '')
    }

    const url = /^https?:\/\//i.test(value) ? new URL(value) : null
    const path = url ? url.pathname.replace(/^\/+|\/+$/g, '') : value.replace(/^@+/, '')

    if (type === 'tiktok') {
      const handle = path.replace(/^@+/, '')
      return handle ? `@${handle}` : ''
    }

    if (type === 'instagram' || type === 'facebook') {
      return path.split('/')[0] ?? path
    }
  } catch {
    return value
  }

  return value
}
