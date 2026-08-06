import fs from 'node:fs'
import path from 'node:path'
import { BrowserWindow } from 'electron'
import { getKaarobarDataDir } from '../config/paths'
import { getPrintLanguage, getPrintPreviewLabels } from './printLocale'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function writePreviewHtmlFile(prefix: string, html: string): string {
  const previewDir = path.join(getKaarobarDataDir(), 'preview')
  fs.mkdirSync(previewDir, { recursive: true })
  const filePath = path.join(previewDir, `${prefix}-${Date.now()}.html`)
  fs.writeFileSync(filePath, html, 'utf8')
  return filePath
}

/** Inject a screen-only Print / Close toolbar into a full HTML document. */
export function injectPrintPreviewChrome(documentHtml: string): string {
  const labels = getPrintPreviewLabels(getPrintLanguage())
  const chrome = `
<style id="kaarobar-print-preview-style">
  #kaarobar-print-toolbar {
    position: fixed;
    inset-inline: 0;
    top: 0;
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    background: rgba(15, 23, 42, 0.94);
    color: #f8fafc;
    font-family: ui-sans-serif, system-ui, sans-serif;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.28);
  }
  #kaarobar-print-toolbar .hint {
    font-size: 12px;
    opacity: 0.85;
    min-width: 0;
  }
  #kaarobar-print-toolbar .actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }
  #kaarobar-print-toolbar button {
    appearance: none;
    border: 0;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  #kaarobar-print-toolbar button.print {
    background: #2d6df6;
    color: #fff;
  }
  #kaarobar-print-toolbar button.close {
    background: #e2e8f0;
    color: #0f172a;
  }
  body {
    padding-top: 58px !important;
  }
  @media print {
    #kaarobar-print-toolbar,
    #kaarobar-print-preview-style {
      display: none !important;
    }
    body {
      padding-top: 0 !important;
    }
  }
</style>
<div id="kaarobar-print-toolbar" role="toolbar" aria-label="${escapeHtml(labels.previewHint)}">
  <div class="hint">${escapeHtml(labels.previewHint)}</div>
  <div class="actions">
    <button type="button" class="close" onclick="window.close()">${escapeHtml(labels.close)}</button>
    <button type="button" class="print" onclick="window.print()">${escapeHtml(labels.print)}</button>
  </div>
</div>`

  if (/<\/body>/i.test(documentHtml)) {
    return documentHtml.replace(/<\/body>/i, `${chrome}</body>`)
  }
  return `${documentHtml}${chrome}`
}

type OpenPrintPreviewOptions = {
  html: string
  filePrefix: string
  title?: string
  width?: number
  height?: number
}

/**
 * Always opens a visible preview window. Printing only happens when the user
 * clicks Print in the preview toolbar (or uses the OS print shortcut).
 */
export function openPrintPreview(options: OpenPrintPreviewOptions): { ok: true } {
  const previewHtml = injectPrintPreviewChrome(options.html)
  const previewFilePath = writePreviewHtmlFile(options.filePrefix, previewHtml)

  const printWindow = new BrowserWindow({
    show: true,
    width: options.width ?? 720,
    height: options.height ?? 900,
    autoHideMenuBar: true,
    title: options.title ?? 'Preview',
    webPreferences: { sandbox: true, contextIsolation: true },
  })

  void printWindow.loadFile(previewFilePath)
  return { ok: true }
}
