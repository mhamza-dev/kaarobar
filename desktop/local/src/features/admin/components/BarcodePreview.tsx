import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'
import { i18n } from '../../../i18n'

type Props = {
  value: string
  className?: string
}

export function BarcodePreview({ value, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !value.trim()) return
    try {
      JsBarcode(svgRef.current, value.trim(), {
        format: 'CODE128',
        displayValue: true,
        fontSize: 14,
        height: 56,
        margin: 8,
      })
    } catch {
      // invalid barcode content — leave empty
    }
  }, [value])

  if (!value.trim()) return null

  return <svg ref={svgRef} className={className} />
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function printBarcodeLabel(name: string, barcode: string) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  try {
    JsBarcode(svg, barcode, { format: 'CODE128', displayValue: true, height: 60, margin: 8 })
  } catch {
    return
  }
  const win = window.open('', '_blank', 'width=420,height=360')
  if (!win) return
  const printLabel = i18n.t('barcode.print')
  const closeLabel = i18n.t('common.close')
  const hint = i18n.t('barcode.previewHint')
  const safeName = escapeHtml(name)
  win.document.write(`
    <html><head><title>${safeName}</title>
    <style>
      body { font-family: sans-serif; text-align: center; padding: 72px 16px 16px; margin: 0; }
      h1 { font-size: 14px; margin: 0 0 8px; }
      svg { max-width: 100%; }
      #kaarobar-print-toolbar {
        position: fixed; inset-inline: 0; top: 0; z-index: 99999;
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        padding: 10px 14px; background: rgba(15, 23, 42, 0.94); color: #f8fafc;
        font-family: ui-sans-serif, system-ui, sans-serif;
      }
      #kaarobar-print-toolbar .hint { font-size: 12px; opacity: 0.85; }
      #kaarobar-print-toolbar .actions { display: flex; gap: 8px; }
      #kaarobar-print-toolbar button {
        appearance: none; border: 0; border-radius: 8px; padding: 8px 14px;
        font-size: 13px; font-weight: 600; cursor: pointer;
      }
      #kaarobar-print-toolbar button.print { background: #2d6df6; color: #fff; }
      #kaarobar-print-toolbar button.close { background: #e2e8f0; color: #0f172a; }
      @media print {
        #kaarobar-print-toolbar { display: none !important; }
        body { padding-top: 16px; }
      }
    </style></head><body>
      <div id="kaarobar-print-toolbar" role="toolbar">
        <div class="hint">${escapeHtml(hint)}</div>
        <div class="actions">
          <button type="button" class="close" onclick="window.close()">${escapeHtml(closeLabel)}</button>
          <button type="button" class="print" onclick="window.print()">${escapeHtml(printLabel)}</button>
        </div>
      </div>
      <h1>${safeName}</h1>
      ${svg.outerHTML}
    </body></html>
  `)
  win.document.close()
}
