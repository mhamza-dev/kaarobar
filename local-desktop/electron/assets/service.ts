import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { dialog } from 'electron'
import { requirePermission } from '../auth/guards'
import { getAssetsDir } from '../config/paths'

export type AssetKind = 'logo' | 'product'

export function getAssetsRootDir(): string {
  return getAssetsDir()
}

export function getAssetKindDir(kind: AssetKind): string {
  const dir = path.join(getAssetsRootDir(), kind === 'logo' ? 'logos' : 'products')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

/** Resolve a relative asset path (e.g. logos/xyz.png) under assets root. */
export function resolveAssetAbsolutePath(relativePath: string): string {
  const normalized = relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/')
  if (!normalized || normalized.includes('..')) {
    throw new Error('Invalid asset path')
  }
  const root = path.resolve(getAssetsRootDir())
  const absolute = path.resolve(root, normalized)
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep
  if (absolute !== root && !absolute.startsWith(rootWithSep)) {
    throw new Error('Invalid asset path')
  }
  return absolute
}

/** Renderer-safe custom protocol URL. Triple-slash keeps the full path in pathname. */
export function assetUrl(relativePath: string | null | undefined): string | null {
  if (!relativePath) return null
  const clean = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  return `kaarobar-asset:///${clean}`
}

export function mimeForAsset(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    case '.svg':
      return 'image/svg+xml'
    case '.png':
    default:
      return 'image/png'
  }
}

/** Serve a stored asset for the kaarobar-asset protocol. */
export function serveAssetRequest(requestUrl: string): Response {
  try {
    const url = new URL(requestUrl)
    const relative = decodeURIComponent(
      url.hostname ? `${url.hostname}${url.pathname}` : url.pathname,
    ).replace(/^\/+/, '')
    const absolute = resolveAssetAbsolutePath(relative)
    if (!fs.existsSync(absolute)) {
      return new Response('Not found', { status: 404 })
    }
    const data = fs.readFileSync(absolute)
    return new Response(data, {
      status: 200,
      headers: {
        'Content-Type': mimeForAsset(absolute),
        'Content-Length': String(data.byteLength),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}

export async function pickAndSaveAsset(kind: AssetKind): Promise<{
  relativePath: string
  url: string
} | null> {
  if (kind === 'logo') requirePermission('business:edit')
  else requirePermission('products:edit')

  const result = await dialog.showOpenDialog({
    title: kind === 'logo' ? 'Choose business logo' : 'Choose product image',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
  })
  if (result.canceled || !result.filePaths[0]) return null

  const source = result.filePaths[0]
  const ext = path.extname(source).toLowerCase() || '.png'
  const fileName = `${randomUUID()}${ext}`
  const folder = kind === 'logo' ? 'logos' : 'products'
  const targetDir = getAssetKindDir(kind)
  const target = path.join(targetDir, fileName)
  fs.copyFileSync(source, target)
  const relativePath = `${folder}/${fileName}`
  return { relativePath, url: assetUrl(relativePath)! }
}
