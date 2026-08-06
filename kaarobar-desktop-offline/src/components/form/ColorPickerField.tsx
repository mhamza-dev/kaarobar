import { useId } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import {
  BRAND_COLOR_PRESETS,
  applyBrandTheme,
  deriveBrandPalette,
  resolveBrandPresetHex,
} from '../../lib/theme'

type Props = {
  label: string
  value: string
  onChange: (hex: string) => void
  applyLiveTheme?: boolean
  className?: string
  id?: string
  disabled?: boolean
}

export function ColorPickerField({
  label,
  value,
  onChange,
  applyLiveTheme = false,
  className,
  id,
  disabled = false,
}: Props) {
  const { t } = useTranslation()
  const autoId = useId()
  const fieldId = id ?? autoId
  const selected = resolveBrandPresetHex(value)
  const palette = deriveBrandPalette(selected)

  function select(hex: string) {
    if (disabled) return
    onChange(hex)
    if (applyLiveTheme) applyBrandTheme(hex)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label id={`${fieldId}-label`} className="block text-sm font-medium text-ink">
          {label}
        </label>
        <p className="text-xs text-ink-muted">{t('brandColors.hint')}</p>
      </div>

      <div
        className="grid grid-cols-4 gap-2 sm:grid-cols-8"
        role="radiogroup"
        aria-labelledby={`${fieldId}-label`}
      >
        {BRAND_COLOR_PRESETS.map((preset) => {
          const active = selected.toLowerCase() === preset.hex.toLowerCase()
          const presetPalette = deriveBrandPalette(preset.hex)
          return (
            <button
              key={preset.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              title={t(preset.labelKey)}
              aria-label={t(preset.labelKey)}
              onClick={() => select(preset.hex)}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-lg border-2 shadow-soft transition-[transform,box-shadow,border-color] duration-pos',
                'hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/40',
                active ? 'border-ink scale-[1.03] shadow-glow' : 'border-transparent',
                disabled && 'cursor-not-allowed opacity-50 hover:translate-y-0',
              )}
              style={{ backgroundColor: preset.hex }}
            >
              {active ? (
                <span
                  className="absolute inset-0 grid place-items-center"
                  style={{ color: presetPalette.onPrimary }}
                >
                  <Check className="size-5 drop-shadow-sm" strokeWidth={2.5} aria-hidden />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div
        className="flex items-center justify-between gap-3 rounded-lg px-4 py-3 shadow-soft transition-colors duration-pos"
        style={{ backgroundColor: palette.primary, color: palette.onPrimary }}
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
            {t('brandColors.preview')}
          </p>
          <p className="truncate text-sm font-semibold">
            {t(
              BRAND_COLOR_PRESETS.find((p) => p.hex.toLowerCase() === selected.toLowerCase())
                ?.labelKey ?? 'brandColors.kaarobar',
            )}
          </p>
        </div>
        <span className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold" style={{ backgroundColor: palette.onPrimary, color: palette.primary }}>
          Aa
        </span>
      </div>
    </div>
  )
}
