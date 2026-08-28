/** Build a renderer URL for a stored relative asset path (logos/…, products/…). */
export function assetSrc(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null
  const clean = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  // Triple-slash form: full path lives in pathname (not hostname).
  return `kaarobar-asset:///${clean}`
}
