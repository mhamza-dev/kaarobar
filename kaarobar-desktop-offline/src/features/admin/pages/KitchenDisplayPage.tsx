import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, EmptyState, Badge, useToast } from '../../../components/ui'
import { PageHeader } from '../../../components/layout'
import { useActionVisibility } from '../../../lib/nav'
import { normalizeBusinessNature, showsTables } from '../../../lib/businessNature'
import { cn } from '../../../lib/cn'
import type { KitchenTicketLine, SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
}

function elapsedLabel(
  firedAt: string | null,
  createdAt: string,
  t: (k: string, o?: Record<string, unknown>) => string,
) {
  const start = new Date(firedAt || createdAt).getTime()
  const mins = Math.max(0, Math.floor((Date.now() - start) / 60000))
  return t('kitchen.elapsedMins', { mins })
}

export function KitchenDisplayPage({ user, data }: Props) {
  const { t } = useTranslation()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const { businesses, activeBusinessId } = data
  const business = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null
  const nature = normalizeBusinessNature(business?.businessNature)
  const [lines, setLines] = useState<KitchenTicketLine[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!activeBusinessId || !showsTables(nature)) return
    try {
      setLines(await window.api.kitchen.listActive(activeBusinessId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    } finally {
      setLoading(false)
    }
  }, [activeBusinessId, nature, t, toast])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => void refresh(), 4000)
    return () => window.clearInterval(id)
  }, [refresh])

  const byStation = useMemo(() => {
    const map = new Map<string, KitchenTicketLine[]>()
    for (const line of lines) {
      const key = line.kitchenStation || 'main'
      const list = map.get(key) ?? []
      list.push(line)
      map.set(key, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [lines])

  if (!actions.canCheckout || !showsTables(nature)) return null

  async function bump(itemId: string) {
    try {
      await window.api.kitchen.bump({ itemIds: [itemId] })
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    }
  }

  async function recall(itemId: string) {
    try {
      await window.api.kitchen.recall({ itemIds: [itemId] })
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow={t('dashboard.eyebrowKitchen')}
        title={t('dashboard.kitchen')}
        description={t('dashboard.kitchenDesc')}
        actions={
          <Button type="button" variant="secondary" onClick={() => void refresh()}>
            {t('common.refresh')}
          </Button>
        }
      />

      {loading && lines.length === 0 ? (
        <EmptyState title={t('common.loading')} />
      ) : lines.length === 0 ? (
        <EmptyState title={t('kitchen.emptyTitle')} description={t('kitchen.emptyDesc')} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {byStation.map(([station, stationLines]) => (
            <div key={station} className="flex flex-col gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-muted">
                {t('kitchen.station', { name: station })}
              </h2>
              {stationLines.map((line) => (
                <Card
                  key={line.itemId}
                  className={cn(
                    'flex flex-col gap-3 border p-4',
                    line.kitchenStatus === 'ready' && 'border-success/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold text-ink">
                        {line.qty}× {line.productName}
                      </p>
                      <p className="text-sm text-ink-muted">
                        {line.tableName
                          ? t('kitchen.table', { name: line.tableName })
                          : t(`serviceModes.${line.serviceMode}`)}
                        {line.seatNo != null ? ` · ${t('kitchen.seat', { n: line.seatNo })}` : ''}
                      </p>
                    </div>
                    <Badge>{elapsedLabel(line.firedAt, line.createdAt, t)}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" onClick={() => void bump(line.itemId)}>
                      {t('kitchen.bump')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void recall(line.itemId)}
                    >
                      {t('kitchen.recall')}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
