import { AlertTriangle, HelpCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Modal } from './Modal'
import { Button } from './Button'
import { ProgressBar } from './ProgressBar'

export type ConfirmDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  progress?: {
    percent: number
    label: string
  } | null
}

/**
 * Ask before doing something that cannot be taken back.
 *
 * ## The consequence is the content
 *
 * This used to hand `description` to `Modal`, which renders it in the header
 * beside the close button — 12px, muted, one cramped line — and then filled the
 * body with a 4px spacer. So the one thing the dialog exists to say ("their
 * sales are deleted too, stock goes back, credit is reversed") was the smallest
 * and faintest text on screen, while the body sat empty.
 *
 * It now reads at body size, at full ink contrast, in a tone-tinted panel with
 * a solid edge rule. Someone about to delete a customer's entire history should
 * not have to squint at the reason not to.
 *
 * The panel's edge rule is the one visual device shared with `Toast` — the same
 * mark means the same thing in both places: this is the part that matters.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  danger = false,
  loading = false,
  progress = null,
}: ConfirmDialogProps) {
  const { t } = useTranslation()
  const Icon = danger ? AlertTriangle : HelpCircle
  const body = description ?? t('common.areYouSure')

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={onClose}
            disabled={loading}
          >
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            className="w-full sm:w-auto"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <div
        className={cn(
          'flex gap-3.5 rounded-lg p-3.5 sm:gap-4 sm:p-4',
          // The edge rule carries the tone; the fill only has to separate the
          // panel from the dialog.
          //
          // `danger-soft` is one of the few tone fills redefined for dark mode,
          // so ink stays legible on it either way. `brand-tint` is not — it
          // stays pale in dark mode, where near-white ink on top of it would be
          // unreadable — so the neutral panel uses `surface-muted`, which does
          // flip, and lets the edge alone carry the brand.
          'border-s-[3px]',
          danger
            ? 'border-s-danger bg-danger-soft/40'
            : 'border-s-brand-primary bg-surface-muted/60',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg',
            danger ? 'bg-danger-soft text-danger' : 'bg-brand-tint text-brand-primary',
          )}
        >
          <Icon className="size-[18px]" strokeWidth={2.2} />
        </span>
        <p className="min-w-0 text-sm leading-relaxed text-ink [overflow-wrap:anywhere]">{body}</p>
      </div>

      {progress ? (
        <ProgressBar
          className="mt-4"
          value={progress.percent}
          label={progress.label}
          tone={danger ? 'warning' : 'brand'}
        />
      ) : null}
    </Modal>
  )
}
