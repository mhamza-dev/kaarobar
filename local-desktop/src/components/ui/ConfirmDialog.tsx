import { useTranslation } from 'react-i18next'
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

  return (
    <Modal
      open={open}
      onClose={loading ? () => undefined : onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      {progress ? (
        <ProgressBar
          className="mt-1"
          value={progress.percent}
          label={progress.label}
          tone={danger ? 'warning' : 'brand'}
        />
      ) : !description ? (
        <p className="text-sm text-ink-muted">{t('common.areYouSure')}</p>
      ) : (
        <div className="h-1" aria-hidden />
      )}
    </Modal>
  )
}
