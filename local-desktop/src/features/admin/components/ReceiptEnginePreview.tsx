import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../../lib/cn'
import type {
  PosPaperWidth,
  PosReceiptTemplate,
  ReceiptPreviewSample,
} from '../../../../shared/types/api'

/**
 * Natural on-screen width of each print document at 96dpi: printable content
 * plus the document's own padding (roll: content + 2×2mm; sheet: 180mm body +
 * 2×10mm). Used to scale the iframe down to the preview slot.
 */
const NATURAL_WIDTH_PX: Record<PosPaperWidth, number> = {
  '58mm': 197,
  '76mm': 257,
  '80mm': 287,
  A4: 756,
  Letter: 756,
}

export type ReceiptEnginePreviewProps = {
  template: PosReceiptTemplate
  paper: PosPaperWidth
  sample: ReceiptPreviewSample
  /** Width the preview is scaled down to, in px. */
  fitWidth: number
  /** Crop the (scaled) preview at this height, in px. */
  maxHeight?: number
  /** Debounce for re-renders while the user is typing. */
  debounceMs?: number
  className?: string
}

/**
 * A receipt preview rendered by the real print engine (via printer.preview),
 * so the settings page shows exactly what a sale will print. The document runs
 * in a sandboxed iframe (its barcode is drawn by an inline script) and reports
 * its height back with postMessage.
 */
export function ReceiptEnginePreview({
  template,
  paper,
  sample,
  fitWidth,
  maxHeight,
  debounceMs = 0,
  className,
}: ReceiptEnginePreviewProps) {
  const { t } = useTranslation()
  const [html, setHtml] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null)
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const requestSeq = useRef(0)

  // One key for "anything that changes the rendered document" — keeps the
  // effect from re-firing on referentially-new-but-equal sample objects.
  const payloadKey = useMemo(
    () => JSON.stringify({ template, paper, sample }),
    [template, paper, sample],
  )

  useEffect(() => {
    const seq = ++requestSeq.current
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const result = await window.api.printer.preview({ template, paper, sample })
          // Last request wins; stale responses are dropped.
          if (requestSeq.current !== seq) return
          setFailed(false)
          setHtml(result.html)
        } catch {
          if (requestSeq.current !== seq) return
          setFailed(true)
        }
      })()
    }, debounceMs)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, debounceMs])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Several previews can coexist — only trust our own iframe.
      if (event.source !== iframeRef.current?.contentWindow) return
      const height = (event.data as { __kaarobarPreviewHeight?: unknown } | null)
        ?.__kaarobarPreviewHeight
      if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
        setNaturalHeight(height)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const naturalWidth = NATURAL_WIDTH_PX[paper] ?? 287
  const scale = fitWidth / naturalWidth
  const fallbackHeight = Math.ceil(fitWidth * 1.6)
  const scaledHeight = naturalHeight ? Math.ceil(naturalHeight * scale) : fallbackHeight
  const height = maxHeight ? Math.min(scaledHeight, maxHeight) : scaledHeight

  return (
    <div
      dir="ltr"
      className={cn(
        'overflow-hidden rounded-lg border border-line/80 bg-white shadow-soft',
        className,
      )}
      style={{ width: fitWidth, height }}
    >
      {html ? (
        <iframe
          ref={iframeRef}
          title={t('forms.receiptPreview')}
          srcDoc={html}
          sandbox="allow-scripts"
          tabIndex={-1}
          className="pointer-events-none select-none border-0"
          style={{
            width: naturalWidth,
            height: naturalHeight ?? Math.ceil(fallbackHeight / scale),
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        />
      ) : (
        // Fixed gray: the box is paper-white in both themes, so theme tokens
        // (light-on-dark in dark mode) would vanish here.
        <div className="grid h-full place-items-center px-2 text-center text-xs text-[#888]">
          {failed ? t('printer.previewFailed') : t('printer.previewLoading')}
        </div>
      )}
    </div>
  )
}
