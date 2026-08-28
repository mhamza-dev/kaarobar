import fs from 'node:fs'
import { nativeImage } from 'electron'

/**
 * Encode an image as an ESC/POS raster bit image (`GS v 0`).
 *
 * Uses Electron's own `nativeImage` to decode and scale, so no image library is
 * added — it already ships with the runtime and handles PNG/JPEG.
 *
 * The printer head is 1-bit: every pixel is either burned or not. How the image
 * gets there depends on what it is — see rasterFromBgra, which picks between a
 * hard threshold for flat logo artwork and dithering for continuous tone.
 */
/**
 * Decoded-raster cache. Logos change rarely but print on every receipt, and
 * decode + resize + dither is the slow part; the mtime in the key invalidates
 * the entry when the file is replaced.
 */
const rasterCache = new Map<string, Buffer | null>()

export function encodeImageRaster(
  absolutePath: string,
  maxWidthDots: number,
): Buffer | null {
  if (!absolutePath || !fs.existsSync(absolutePath)) return null

  let cacheKey: string | null = null
  try {
    const stat = fs.statSync(absolutePath)
    cacheKey = `${absolutePath}::${maxWidthDots}::${stat.mtimeMs}::${stat.size}`
    const cached = rasterCache.get(cacheKey)
    if (cached !== undefined) return cached
  } catch {
    cacheKey = null
  }

  const raster = decodeImageRaster(absolutePath, maxWidthDots)
  if (cacheKey) {
    if (rasterCache.size > 32) rasterCache.clear()
    rasterCache.set(cacheKey, raster)
  }
  return raster
}

function decodeImageRaster(
  absolutePath: string,
  maxWidthDots: number,
): Buffer | null {
  let img = nativeImage.createFromPath(absolutePath)
  if (img.isEmpty()) return null

  const size = img.getSize()
  if (!size.width || !size.height) return null

  // Raster rows are byte-aligned, so round the width down to a multiple of 8.
  const targetWidth = Math.max(8, Math.min(maxWidthDots, size.width) & ~7)
  if (targetWidth !== size.width) {
    img = img.resize({ width: targetWidth, quality: 'good' })
  }

  const { width, height } = img.getSize()
  if (!width || !height) return null

  return rasterFromBgra(img.getBitmap() as unknown as Buffer, width, height)
}

/**
 * Pure part: BGRA pixels -> `GS v 0` raster bytes. Separated from the decode so
 * it can be tested without an Electron runtime.
 */
export function rasterFromBgra(
  bgra: Buffer,
  width: number,
  height: number,
): Buffer | null {
  if (width <= 0 || height <= 0 || width % 8 !== 0) return null
  // A short buffer would read as undefined -> NaN luminance, which silently
  // poisons the histogram and the dithering error term. Refuse it instead.
  if (bgra.length < width * height * 4) return null

  const gray = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const b = bgra[i * 4]
    const g = bgra[i * 4 + 1]
    const r = bgra[i * 4 + 2]
    const a = bgra[i * 4 + 3] / 255
    // Composite onto white so transparent regions do not print as black.
    const lum = 0.299 * r + 0.587 * g + 0.114 * b
    gray[i] = lum * a + 255 * (1 - a)
  }

  const dots = isFlatArtwork(gray) ? thresholdDots(gray) : ditherDots(gray, width, height)

  const bytesPerRow = width / 8
  const raster = Buffer.alloc(bytesPerRow * height, 0)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 1 = burn the dot.
      if (dots[y * width + x]) {
        raster[y * bytesPerRow + (x >> 3)] |= 0x80 >> (x & 7)
      }
    }
  }

  // GS v 0 m xL xH yL yH  — m=0 is normal density.
  const header = Buffer.from([
    0x1d,
    0x76,
    0x30,
    0x00,
    bytesPerRow & 0xff,
    (bytesPerRow >> 8) & 0xff,
    height & 0xff,
    (height >> 8) & 0xff,
  ])
  return Buffer.concat([header, raster])
}

/** Share of pixels the four commonest luminance bins must cover to count as flat. */
const FLAT_HISTOGRAM_SHARE = 0.7

/**
 * Is this artwork built from a few flat colours (a logo) rather than a
 * continuous range of tones (a photo)?
 *
 * The distinction decides how the image is reduced to 1-bit, and getting it
 * wrong is very visible: dithering a flat mid-tone fill does not reproduce the
 * colour, it scatters it into random dots. The Kaarobar mark — a white glyph on
 * solid brand blue — printed as a grey noise rectangle for exactly that reason,
 * since blue sits near the middle of the luminance range.
 */
function isFlatArtwork(gray: Float32Array): boolean {
  const bins = new Array<number>(64).fill(0)
  for (let i = 0; i < gray.length; i++) {
    bins[Math.max(0, Math.min(63, Math.floor(gray[i] / 4)))] += 1
  }
  bins.sort((a, b) => b - a)
  const dominant = bins[0] + bins[1] + bins[2] + bins[3]
  return dominant >= gray.length * FLAT_HISTOGRAM_SHARE
}

/**
 * Flat artwork: a hard threshold, which keeps edges crisp.
 *
 * The cut point comes from Otsu's method rather than a fixed 128 — a logo's two
 * tones can sit anywhere on the scale, and a fixed midpoint would swallow one of
 * them whole.
 */
function thresholdDots(gray: Float32Array): Uint8Array {
  const cut = otsuThreshold(gray)
  const dots = new Uint8Array(gray.length)
  let burned = 0
  for (let i = 0; i < gray.length; i++) {
    // Round exactly as otsuThreshold's histogram does. Comparing the raw float
    // against a cut derived from integer bins drops the tone that *is* the cut:
    // a fill at luminance 105.5 lands in bin 105, yet 105.5 <= 105 is false, so
    // the whole background would silently stop printing.
    if (quantize(gray[i]) <= cut) {
      dots[i] = 1
      burned += 1
    }
  }

  // A logo whose background is the dark tone would print as a near-solid slab:
  // slow, heavy on the print head, and unreadable at receipt size. Flip it so the
  // artwork is ink on white paper, which is what the paper already gives us.
  if (burned > gray.length / 2) {
    for (let i = 0; i < dots.length; i++) dots[i] ^= 1
  }
  return dots
}

/** Luminance -> histogram bin. The single place tones are mapped to integers. */
function quantize(lum: number): number {
  return Math.max(0, Math.min(255, Math.round(lum)))
}

/** Otsu's method: the cut that best separates the luminance histogram in two. */
function otsuThreshold(gray: Float32Array): number {
  const hist = new Array<number>(256).fill(0)
  for (let i = 0; i < gray.length; i++) hist[quantize(gray[i])] += 1

  let total = 0
  for (let t = 0; t < 256; t++) total += t * hist[t]

  let weightBelow = 0
  let sumBelow = 0
  let best = -1
  let cut = 128
  for (let t = 0; t < 256; t++) {
    weightBelow += hist[t]
    if (weightBelow === 0) continue
    const weightAbove = gray.length - weightBelow
    if (weightAbove === 0) break

    sumBelow += t * hist[t]
    const meanBelow = sumBelow / weightBelow
    const meanAbove = (total - sumBelow) / weightAbove
    const spread = weightBelow * weightAbove * (meanBelow - meanAbove) ** 2
    if (spread > best) {
      best = spread
      cut = t
    }
  }
  return cut
}

/**
 * Continuous-tone artwork: Floyd–Steinberg dithering.
 *
 * The printer head is 1-bit, so a photographic logo needs its greys traded for
 * dot density or it collapses into a silhouette.
 */
function ditherDots(gray: Float32Array, width: number, height: number): Uint8Array {
  // Copy: the diffusion below is destructive and the caller's array is reused.
  const work = Float32Array.from(gray)
  const dots = new Uint8Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      const old = work[i]
      const next = old < 128 ? 0 : 255
      const err = old - next
      work[i] = next
      dots[i] = next === 0 ? 1 : 0
      if (x + 1 < width) work[i + 1] += (err * 7) / 16
      if (y + 1 < height) {
        if (x > 0) work[i + width - 1] += (err * 3) / 16
        work[i + width] += (err * 5) / 16
        if (x + 1 < width) work[i + width + 1] += (err * 1) / 16
      }
    }
  }
  return dots
}
