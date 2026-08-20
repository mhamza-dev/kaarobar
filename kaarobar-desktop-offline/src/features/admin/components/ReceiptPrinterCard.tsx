import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, NumberField, SelectField, Toggle, useToast } from '../../../components/ui'
import type {
  PosPaperWidth,
  PosPrinterSettings,
  PosTransport,
  PrinterDevice,
  PrinterTestKind,
} from '../../../../shared/types/api'

const PAPER_WIDTHS: PosPaperWidth[] = ['58mm', '76mm', '80mm']

/**
 * Receipt-printer configuration.
 *
 * Lives outside the business Formik form because these settings belong to the
 * install (which printer is plugged into this till), not to the business record.
 */
export function ReceiptPrinterCard() {
  const { t } = useTranslation()
  const toast = useToast()
  const [settings, setSettings] = useState<PosPrinterSettings | null>(null)
  const [printers, setPrinters] = useState<PrinterDevice[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<PrinterTestKind | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [current, devices] = await Promise.all([
        window.api.printer.getSettings(),
        window.api.printer.list().catch(() => [] as PrinterDevice[]),
      ])
      setSettings(current)
      setPrinters(devices)
      setLoadError(null)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save(next: Partial<PosPrinterSettings>) {
    setSaving(true)
    try {
      const saved = await window.api.printer.setSettings(next)
      setSettings(saved)
      toast.success(t('common.save'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  async function runTest(kind: PrinterTestKind) {
    setTesting(kind)
    try {
      const result = await window.api.printer.test(kind)
      if (result.ok) toast.success(t('forms.receiptPrinterTestSent'))
      else toast.error(result.error || t('forms.receiptPrinterTestFailed'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setTesting(null)
    }
  }

  if (loadError) {
    return (
      <Card title={t('forms.receiptPrinter')} description={loadError}>
        <Button variant="secondary" onClick={() => void load()}>
          {t('common.refresh')}
        </Button>
      </Card>
    )
  }

  if (!settings) return null

  const printerOptions = [
    { value: '', label: t('forms.receiptPrinterSystemDefault') },
    ...printers.map((p) => ({
      value: p.name,
      label: p.isDefault ? `${p.displayName} (${t('forms.receiptPrinterDefault')})` : p.displayName,
    })),
  ]

  return (
    <Card
      title={t('forms.receiptPrinter')}
      description={t('forms.receiptPrinterHint')}
    >
      <div className="space-y-4">
        <Toggle
          checked={settings.posPrintEnabled}
          onCheckedChange={(checked) => void save({ posPrintEnabled: checked })}
          label={t('forms.receiptPrinterEnable')}
          hint={t('forms.receiptPrinterEnableHint')}
          disabled={saving}
        />

        {settings.posPrintEnabled ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label={t('forms.receiptPrinterDevice')}
              value={settings.posPrinterName}
              options={printerOptions}
              disabled={saving}
              onChange={(value) => void save({ posPrinterName: value })}
              containerClassName="sm:col-span-2"
            />
            <SelectField
              label={t('forms.receiptPrinterPaper')}
              value={settings.posPaperWidth}
              options={PAPER_WIDTHS.map((w) => ({ value: w, label: w }))}
              disabled={saving}
              onChange={(value) => void save({ posPaperWidth: value as PosPaperWidth })}
            />
            <NumberField
              label={t('forms.receiptPrinterCopies')}
              defaultValue={settings.posCopies}
              min={1}
              max={5}
              allowDecimal={false}
              disabled={saving}
              // Commit on blur: saving per keystroke would write the store on
              // every digit and fight the user mid-edit.
              onBlur={(event) => {
                const next = Number(event.target.value)
                if (Number.isFinite(next) && next !== settings.posCopies) {
                  void save({ posCopies: next })
                }
              }}
            />
            <SelectField
              label={t('forms.receiptPrinterTransport')}
              hint={t('forms.receiptPrinterTransportHint')}
              value={settings.posTransport}
              options={[
                { value: 'raw', label: t('forms.receiptPrinterTransportRaw') },
                { value: 'rendered', label: t('forms.receiptPrinterTransportRendered') },
              ]}
              disabled={saving}
              onChange={(value) => void save({ posTransport: value as PosTransport })}
              containerClassName="sm:col-span-2"
            />
            <div className="sm:col-span-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                loading={testing === 'raw'}
                disabled={saving || testing !== null}
                onClick={() => void runTest('raw')}
              >
                {t('forms.receiptPrinterTestRaw')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                loading={testing === 'rendered'}
                disabled={saving || testing !== null}
                onClick={() => void runTest('rendered')}
              >
                {t('forms.receiptPrinterTestRendered')}
              </Button>
            </div>
            <Toggle
              checked={settings.posSilent}
              onCheckedChange={(checked) => void save({ posSilent: checked })}
              label={t('forms.receiptPrinterSilent')}
              hint={t('forms.receiptPrinterSilentHint')}
              disabled={saving}
            />
          </div>
        ) : null}
      </div>
    </Card>
  )
}
