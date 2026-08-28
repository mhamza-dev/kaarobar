/** Build short uppercase codes from business/branch names for invoice numbers. */
export function abbreviateName(name: string, maxLen = 4): string {
  const words = name
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter(Boolean)

  if (words.length === 0) return 'X'

  if (words.length >= 2) {
    const initials = words
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase()
    return (initials.slice(0, maxLen) || 'X')
  }

  return (words[0].toUpperCase().slice(0, Math.min(3, maxLen)) || 'X')
}

/** e.g. KB-KTA-MB-12 — Kaarobar / business abbrev / branch abbrev / sequence */
export function formatInvoiceNumber(
  businessName: string,
  branchName: string,
  sequence: number,
): string {
  const biz = abbreviateName(businessName)
  const branch = abbreviateName(branchName)
  return `KB-${biz}-${branch}-${sequence}`
}

export function invoicePrefix(businessName: string, branchName: string): string {
  return `KB-${abbreviateName(businessName)}-${abbreviateName(branchName)}-`
}

export function parseInvoiceSequence(invoiceNo: string, prefix: string): number | null {
  if (!invoiceNo.startsWith(prefix)) return null
  const n = Number.parseInt(invoiceNo.slice(prefix.length), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function looksLikeInvoiceBarcode(code: string): boolean {
  return /^KB-[A-Z0-9]+-[A-Z0-9]+-\d+$/i.test(code.trim())
}
