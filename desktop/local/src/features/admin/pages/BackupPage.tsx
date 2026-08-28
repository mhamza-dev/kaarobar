import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, Download, FolderOpen, HardDrive, RotateCcw, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ConfirmDialog,
  ProgressBar,
  Toggle,
  useToast,
} from '../../../components/ui'
import { PageHeader } from '../../../components/layout'
import { useActionVisibility } from '../../../lib/nav'
import { useFormatDate } from '../../../lib/useFormatDate'
import type {
  AutoBackupSettings,
  BackupProgressEvent,
  BackupProgressPhase,
  SessionUser,
} from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
  onRestored: () => void | Promise<void>
}

const PHASE_I18N: Record<BackupProgressPhase, string> = {
  prepare_db: 'backup.progress.prepareDb',
  packing_files: 'backup.progress.packingFiles',
  compressing: 'backup.progress.compressing',
  encrypting: 'backup.progress.encrypting',
  writing: 'backup.progress.writing',
  reading: 'backup.progress.reading',
  decrypting: 'backup.progress.decrypting',
  extracting: 'backup.progress.extracting',
  installing_db: 'backup.progress.installingDb',
  restoring_files: 'backup.progress.restoringFiles',
  finalizing: 'backup.progress.finalizing',
}

export function BackupPage({ user, onRestored }: Props) {
  const { t } = useTranslation()
  const { formatDateTime } = useFormatDate()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const [restorePath, setRestorePath] = useState('')
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [progress, setProgress] = useState<BackupProgressEvent | null>(null)
  const [autoSettings, setAutoSettings] = useState<AutoBackupSettings | null>(null)
  const [savingAuto, setSavingAuto] = useState(false)

  const busy = creating || restoring
  const fileName = restorePath ? restorePath.split(/[/\\]/).pop() ?? restorePath : ''

  useEffect(() => {
    return window.api.backup.onProgress((event) => {
      setProgress(event)
    })
  }, [])

  useEffect(() => {
    if (!actions.canViewBusiness) {
      setAutoSettings(null)
      return
    }
    let cancelled = false
    void window.api.backup
      .getAutoSettings()
      .then((settings) => {
        if (!cancelled) setAutoSettings(settings)
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
      })
    return () => {
      cancelled = true
    }
  }, [actions.canViewBusiness, t, toast])

  const progressLabel = progress
    ? t(PHASE_I18N[progress.phase], {
        defaultValue: progress.operation === 'create' ? t('backup.progress.creating') : t('backup.progress.restoring'),
      })
    : creating
      ? t('backup.progress.creating')
      : restoring
        ? t('backup.progress.restoring')
        : ''

  const saveAuto = async (patch: { autoBackupEnabled?: boolean; autoBackupTime?: string }) => {
    setSavingAuto(true)
    try {
      const next = await window.api.backup.setAutoSettings(patch)
      setAutoSettings(next)
      toast.success(t('backup.autoSaved'))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    } finally {
      setSavingAuto(false)
    }
  }

  const lastRunLabel = autoSettings?.lastAutoBackupAt
    ? formatDateTime(autoSettings.lastAutoBackupAt)
    : t('backup.autoNever')

  if (!actions.canBackupCreate) return null

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrowBackup')}
        title={t('dashboard.backup')}
        description={t('dashboard.backupDesc')}
      />

      <div className="mb-6 flex gap-3 rounded-lg border border-brand-primary/20 bg-gradient-to-br from-brand-tint/80 to-surface-raised p-4 shadow-soft">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-primary text-brand-on-primary">
          <HardDrive className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">{t('backup.introTitle')}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t('backup.introDesc')}</p>
        </div>
      </div>

      {busy ? (
        <Card className="mb-5" accent={restoring ? 'warning' : 'brand'}>
          <ProgressBar
            value={progress?.percent ?? null}
            label={progressLabel}
            tone={restoring ? 'warning' : 'brand'}
          />
        </Card>
      ) : null}

      {actions.canViewBusiness ? (
      <Card className="mb-5">
        <div className="mb-4 flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand-primary">
            <Clock className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-ink">{t('backup.autoTitle')}</h3>
            <p className="mt-1 text-sm text-ink-muted">{t('backup.autoDesc')}</p>
          </div>
        </div>

        {autoSettings ? (
          <div className="space-y-4">
            <Toggle
              checked={autoSettings.autoBackupEnabled}
              disabled={busy || savingAuto}
              label={t('backup.autoEnable')}
              hint={t('backup.autoWhileOpen')}
              onCheckedChange={(checked) => {
                setAutoSettings({ ...autoSettings, autoBackupEnabled: checked })
                void saveAuto({ autoBackupEnabled: checked })
              }}
            />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
              <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
                {t('backup.autoTime')}
                <input
                  type="time"
                  value={autoSettings.autoBackupTime}
                  disabled={busy || savingAuto || !autoSettings.autoBackupEnabled}
                  onChange={(e) => {
                    const autoBackupTime = e.target.value.slice(0, 5)
                    setAutoSettings({ ...autoSettings, autoBackupTime })
                  }}
                  onBlur={() => {
                    void saveAuto({ autoBackupTime: autoSettings.autoBackupTime })
                  }}
                  className="h-10 w-full rounded-lg border border-line bg-surface-raised px-3 text-sm text-ink shadow-soft focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-primary/40 disabled:opacity-60 sm:w-40"
                />
              </label>
              <p className="text-sm text-ink-muted sm:pb-2">
                {t('backup.autoLastRun')}: <span className="font-medium text-ink">{lastRunLabel}</span>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-muted">{t('backup.autoLoading')}</p>
        )}
      </Card>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex h-full flex-col">
          <div className="mb-5 flex items-start gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand-primary">
              <Download className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-ink">{t('backup.createTitle')}</h3>
              <p className="mt-1 text-sm text-ink-muted">{t('backup.createDesc')}</p>
            </div>
          </div>

          <ul className="mb-5 space-y-2 text-sm text-ink-muted">
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-primary" aria-hidden />
              {t('backup.createPoint1')}
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-primary" aria-hidden />
              {t('backup.createPoint2')}
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-primary" aria-hidden />
              {t('backup.createPoint3')}
            </li>
          </ul>

          <div className="mt-auto">
            <Button
              className="w-full sm:w-auto"
              loading={creating}
              disabled={busy}
              onClick={async () => {
                setCreating(true)
                setProgress({ operation: 'create', phase: 'prepare_db', percent: 0 })
                try {
                  const res = await window.api.backup.create()
                  toast.success(`${t('toast.backupSaved')}: ${res.filePath}`)
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
                } finally {
                  setCreating(false)
                  setProgress(null)
                }
              }}
            >
              <Download className="size-4" />
              {t('backup.createAction')}
            </Button>
          </div>
        </Card>

        {actions.canBackupRestore ? (
          <Card className="flex h-full flex-col" accent="warning">
            <div className="mb-5 flex items-start gap-3">
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning">
                <Shield className="size-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-ink">{t('backup.restoreTitle')}</h3>
                  <Badge tone="warning">{t('backup.restoreWarningBadge')}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{t('backup.restoreDesc')}</p>
              </div>
            </div>

            <div className="mb-4 flex gap-2 rounded-lg border border-warning/25 bg-warning-soft/40 px-3 py-2.5 text-sm text-ink">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <p>{t('backup.restoreWarning')}</p>
            </div>

            <div className="mb-5 space-y-2">
              <p className="text-sm font-medium text-ink">{t('backup.chooseFileLabel')}</p>
              <div className="flex flex-col gap-2 rounded-lg border border-dashed border-line bg-surface-muted/50 p-3 sm:flex-row sm:items-center">
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  disabled={busy}
                  onClick={async () => {
                    const picked = await window.api.backup.pickFile()
                    if (picked) setRestorePath(picked)
                  }}
                >
                  <FolderOpen className="size-4" />
                  {t('backup.chooseFile')}
                </Button>
                {restorePath ? (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink" title={fileName}>
                      {fileName}
                    </p>
                    <p className="truncate text-xs text-ink-subtle" title={restorePath}>
                      {restorePath}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-ink-subtle">{t('backup.noFileSelected')}</p>
                )}
              </div>
              <p className="text-xs text-ink-muted">{t('backup.fileHint')}</p>
            </div>

            <div className="mt-auto">
              <Button
                className="w-full sm:w-auto"
                variant="danger"
                disabled={!restorePath.trim() || busy}
                onClick={() => setConfirmRestore(true)}
              >
                <RotateCcw className="size-4" />
                {t('backup.restoreAction')}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="flex h-full flex-col">
            <EmptyState
              title={t('backup.restoreRestricted')}
              description={t('backup.restoreRestrictedDesc')}
            />
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={confirmRestore}
        onClose={() => {
          if (!restoring) setConfirmRestore(false)
        }}
        title={t('backup.confirmRestoreTitle')}
        description={t('backup.confirmRestoreDesc')}
        danger
        confirmLabel={t('backup.restoreAction')}
        loading={restoring}
        progress={
          restoring
            ? {
                percent: progress?.percent ?? 0,
                label: progressLabel || t('backup.progress.restoring'),
              }
            : null
        }
        onConfirm={async () => {
          setRestoring(true)
          setProgress({ operation: 'restore', phase: 'reading', percent: 0 })
          try {
            await window.api.backup.restore(restorePath.trim())
            toast.success(t('toast.backupRestoredLogin'))
            setConfirmRestore(false)
            setRestorePath('')
            await onRestored()
          } catch (e) {
            toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
          } finally {
            setRestoring(false)
            setProgress(null)
          }
        }}
      />
    </div>
  )
}
