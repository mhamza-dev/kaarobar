import { HardDrive, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Card, ProgressBar } from '../../../components/ui'
import { cn } from '../../../lib/cn'

type Props = {
  loading: boolean
  error?: string
  progress?: {
    percent: number
    label: string
  } | null
  onFresh: () => void
  onRestore: () => void
  onBack: () => void
}

export function RestoreChoiceStep({
  loading,
  error,
  progress = null,
  onFresh,
  onRestore,
  onBack,
}: Props) {
  const { t } = useTranslation()

  return (
    <Card title={t('setup.modeTitle')} description={t('setup.modeDesc')} accent="brand">
      <div className="space-y-4">
        {error ? (
          <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm font-medium text-danger" role="alert">
            {error}
          </p>
        ) : null}

        {loading && progress ? (
          <ProgressBar className="rounded-lg border border-line/60 bg-surface-muted/50 p-3" value={progress.percent} label={progress.label} />
        ) : null}

        <div className="grid gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={onFresh}
            className={cn(
              'group flex w-full items-start gap-3 rounded-lg border border-line/80 bg-surface-raised/70 p-4 text-start shadow-soft backdrop-blur-sm transition-[border-color,box-shadow,transform,background-color] duration-200',
              'hover:-translate-y-0.5 hover:border-brand-primary/45 hover:bg-brand-tint/35 hover:shadow-lift',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/35',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand-primary transition-colors group-hover:bg-brand-primary group-hover:text-brand-on-primary">
              <Sparkles className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-ink">{t('setup.startFresh')}</span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{t('setup.startFreshDesc')}</span>
            </span>
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={onRestore}
            className={cn(
              'group flex w-full items-start gap-3 rounded-lg border border-line/80 bg-surface-raised/70 p-4 text-start shadow-soft backdrop-blur-sm transition-[border-color,box-shadow,transform,background-color] duration-200',
              'hover:-translate-y-0.5 hover:border-brand-primary/45 hover:bg-brand-tint/35 hover:shadow-lift',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/35',
              'disabled:pointer-events-none disabled:opacity-50',
            )}
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-muted text-ink-muted transition-colors group-hover:bg-brand-primary group-hover:text-brand-on-primary">
              <HardDrive className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold tracking-tight text-ink">{t('setup.restoreBackup')}</span>
              <span className="mt-1 block text-xs leading-relaxed text-ink-muted">{t('setup.restoreBackupDesc')}</span>
            </span>
          </button>
        </div>

        <Button type="button" variant="ghost" className="w-full sm:w-auto" disabled={loading} onClick={onBack}>
          {t('common.back')}
        </Button>
      </div>
    </Card>
  )
}
