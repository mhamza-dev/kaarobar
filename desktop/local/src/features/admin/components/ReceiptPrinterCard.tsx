import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { RefreshCw } from 'lucide-react'
import { Button, Card, SelectField, Toggle, useToast } from '../../../components/ui'
import type {
  PosPrinterSettings,
  PrinterDevice,
  PrinterTestKind,
} from '../../../../shared/types/api'

type Props = {
  /** Fires with the canonical settings on load and after every save. */
  onSettingsSaved?: (settings: PosPrinterSettings) => void
}

/**
 * Per-device receipt printer configuration.
 *
 * Unlike the rest of the settings page this is not business data — it lives in
 * the local config store of this till (electron-store), so it saves on change
 * instead of riding the page's Save button.
 */
export function ReceiptPrinterCard({ onSettingsSaved }: Props = {}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [settings, setSettings] = useState<PosPrinterSettings | null>(null)
  const [printers, setPrinters] = useState<PrinterDevice[]>([])
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [testing, setTesting] = useState<PrinterTestKind | null>(null)

  const refreshPrinters = useCallback(async () => {
    setLoadingPrinters(true)
    try {
      setPrinters(await window.api.printer.list())
    } catch {
      setPrinters([])
    } finally {
      setLoadingPrinters(false)
    }
  }, [])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [loaded, devices] = await Promise.all([
          window.api.printer.getSettings(),
          window.api.printer.list(),
        ])
        if (!alive) return
        setSettings(loaded)
        onSettingsSaved?.(loaded)
        setPrinters(devices)
      } catch (e) {
        if (!alive) return
        toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
      }
    })()
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = useCallback(
    async (patch: Partial<PosPrinterSettings>) => {
      // Optimistic so selects don't flicker; the canonical (normalised)
      // settings from the main process replace it right after.
      setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
      try {
        const next = await window.api.printer.setSettings(patch)
        setSettings(next)
        onSettingsSaved?.(next)
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
        try {
          const reloaded = await window.api.printer.getSettings()
          setSettings(reloaded)
          onSettingsSaved?.(reloaded)
        } catch {
          // Keep the optimistic state; nothing better to show.
        }
      }
    },
    [t, toast, onSettingsSaved],
  )

  const runTest = useCallback(
    async (kind: PrinterTestKind) => {
      setTesting(kind)
      try {
        const result = await window.api.printer.test(kind)
        if (result.ok) {
          toast.success(t('printer.testSent'), result.printerName)
        } else {
          toast.error(t('printer.testFailed'), result.error)
        }
      } catch (e) {
        toast.error(t('printer.testFailed'), e instanceof Error ? e.message : undefined)
      } finally {
        setTesting(null)
      }
    },
    [t, toast],
  )

  if (!settings) return null

  const isRoll =
    settings.posPaperWidth === '58mm' ||
    settings.posPaperWidth === '76mm' ||
    settings.posPaperWidth === '80mm'
  const effectiveRendered = !isRoll || settings.posTransport === 'rendered'

  const printerOptions = [
    { value: '', label: t('printer.systemDefault') },
    ...printers.map((p) => ({
      value: p.name,
      label: p.isDefault ? `${p.displayName} — ${t('printer.defaultMark')}` : p.displayName,
    })),
  ]
  // A configured printer that is currently unplugged should stay selectable
  // (and visible) rather than silently snapping to system default.
  if (settings.posPrinterName && !printers.some((p) => p.name === settings.posPrinterName)) {
    printerOptions.push({
      value: settings.posPrinterName,
      label: `${settings.posPrinterName} — ${t('printer.offlineMark')}`,
    })
  }

  const paperOptions = [
    { value: '58mm', label: t('printer.paper58') },
    { value: '76mm', label: t('printer.paper76') },
    { value: '80mm', label: t('printer.paper80') },
    { value: 'A4', label: t('printer.paperA4') },
    { value: 'Letter', label: t('printer.paperLetter') },
  ]

  const methodOptions = [
    { value: 'raw', label: t('printer.methodRaw') },
    { value: 'rendered', label: t('printer.methodRendered') },
  ]

  return (
    <Card title={t('printer.title')} description={t('printer.description')}>
      <div className="space-y-5">
        <Toggle
          checked={settings.posPrintEnabled}
          onCheckedChange={(checked) => void save({ posPrintEnabled: checked })}
          label={t('printer.enable')}
          hint={t('printer.enableHint')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-end gap-2">
            <SelectField
              label={t('printer.device')}
              options={printerOptions}
              value={settings.posPrinterName}
              onChange={(value) => void save({ posPrinterName: value })}
              containerClassName="w-full min-w-0"
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="shrink-0 px-3"
              onClick={() => void refreshPrinters()}
              loading={loadingPrinters}
              aria-label={t('printer.refresh')}
              title={t('printer.refresh')}
            >
              {loadingPrinters ? null : <RefreshCw className="size-4" />}
            </Button>
          </div>

          <SelectField
            label={t('printer.paper')}
            options={paperOptions}
            value={settings.posPaperWidth}
            onChange={(value) =>
              void save({ posPaperWidth: value as PosPrinterSettings['posPaperWidth'] })
            }
          />

          {isRoll ? (
            <SelectField
              label={t('printer.method')}
              hint={
                settings.posTransport === 'raw'
                  ? t('printer.methodRawHint')
                  : t('printer.methodRenderedHint')
              }
              options={methodOptions}
              value={settings.posTransport}
              onChange={(value) =>
                void save({ posTransport: value as PosPrinterSettings['posTransport'] })
              }
            />
          ) : null}

          <SelectField
            label={t('printer.copies')}
            options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
            value={String(settings.posCopies)}
            onChange={(value) => void save({ posCopies: Number(value) })}
          />
        </div>

        {effectiveRendered ? (
          <Toggle
            checked={settings.posSilent}
            onCheckedChange={(checked) => void save({ posSilent: checked })}
            label={t('printer.silent')}
            hint={t('printer.silentHint')}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-2 border-t border-line/70 pt-4">
          <p className="me-auto text-sm text-ink-muted">{t('printer.testHint')}</p>
          {isRoll ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={testing === 'raw'}
              disabled={testing !== null}
              onClick={() => void runTest('raw')}
            >
              {t('printer.testRaw')}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            loading={testing === 'rendered'}
            disabled={testing !== null}
            onClick={() => void runTest('rendered')}
          >
            {isRoll ? t('printer.testRendered') : t('printer.testPage')}
          </Button>
        </div>
      </div>
    </Card>
  )
}
