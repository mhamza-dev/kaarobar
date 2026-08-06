import { useTranslation } from 'react-i18next'
import type { ActivityEntry } from '../../../../shared/types/api'
import { useFormatDate } from '../../../lib/useFormatDate'

type Props = {
  entries: ActivityEntry[]
}

export function ActivityTimeline({ entries }: Props) {
  const { t } = useTranslation()
  const { formatDateTime } = useFormatDate()

  if (entries.length === 0) {
    return <p className="text-sm text-ink-muted">{t('empty.noActivity')}</p>
  }

  return (
    <ol className="space-y-3 border-s border-line ps-4">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -start-[1.3rem] top-1.5 size-2.5 rounded-full bg-brand-primary" aria-hidden />
          <p className="text-sm font-medium text-ink">{entry.summary}</p>
          <p className="text-xs text-ink-muted">
            {entry.actorName} · {formatDateTime(entry.createdAt)} · {entry.action}
          </p>
        </li>
      ))}
    </ol>
  )
}
