import { Armchair, Pencil, Plus, Power, Users } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFormatMoney } from '../../../lib/useFormatMoney'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Modal,
  TextField,
  useToast,
} from '../../../components/ui'
import { PageHeader } from '../../../components/layout'
import { useActionVisibility } from '../../../lib/nav'
import { normalizeBusinessNature, showsTables } from '../../../lib/businessNature'
import { cn } from '../../../lib/cn'
import { RowActionsMenu } from '../components/RowActionsMenu'
import type { DiningTable, SessionUser } from '../../../../shared/types/api'
import type { AdminData } from '../hooks/useAdminData'

type Props = {
  user: SessionUser
  data: AdminData
}

type FloorFilter = 'all' | 'free' | 'occupied' | 'inactive'

export function TablesPage({ user, data }: Props) {
  const { t } = useTranslation()
  const formatMoney = useFormatMoney()
  const toast = useToast()
  const actions = useActionVisibility(user)
  const { businesses, activeBusinessId } = data
  const business = businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null
  const nature = normalizeBusinessNature(business?.businessNature)
  const [tables, setTables] = useState<DiningTable[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FloorFilter>('all')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DiningTable | null>(null)
  const [name, setName] = useState('')
  const [seats, setSeats] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = useCallback(async () => {
    if (!activeBusinessId || !showsTables(nature)) return
    setLoading(true)
    try {
      setTables(await window.api.tables.list(activeBusinessId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    } finally {
      setLoading(false)
    }
  }, [activeBusinessId, nature, t, toast])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const summary = useMemo(() => {
    const free = tables.filter((table) => table.isActive && !table.occupied).length
    const occupied = tables.filter((table) => table.isActive && table.occupied).length
    const inactive = tables.filter((table) => !table.isActive).length
    return { total: tables.length, free, occupied, inactive }
  }, [tables])

  const visibleTables = useMemo(() => {
    return tables.filter((table) => {
      if (filter === 'free') return table.isActive && !table.occupied
      if (filter === 'occupied') return table.isActive && table.occupied
      if (filter === 'inactive') return !table.isActive
      return true
    })
  }, [tables, filter])

  if (!actions.canEditTables || !showsTables(nature)) return null

  function openCreate() {
    setEditing(null)
    setName('')
    setSeats('')
    setOpen(true)
  }

  function openEdit(table: DiningTable) {
    setEditing(table)
    setName(table.name)
    setSeats(table.seats != null ? String(table.seats) : '')
    setOpen(true)
  }

  async function toggleActive(table: DiningTable) {
    try {
      await window.api.tables.update({
        id: table.id,
        name: table.name,
        seats: table.seats,
        sortOrder: table.sortOrder,
        isActive: !table.isActive,
      })
      toast.success(table.isActive ? t('toast.tableDeactivated') : t('toast.tableActivated'))
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    }
  }

  async function save() {
    if (!activeBusinessId) return
    const trimmed = name.trim()
    if (!trimmed) {
      toast.error(t('tables.nameRequired'))
      return
    }
    setSaving(true)
    try {
      const seatsValue = seats.trim() ? Number(seats) : null
      if (editing) {
        await window.api.tables.update({
          id: editing.id,
          name: trimmed,
          seats: seatsValue,
          sortOrder: editing.sortOrder,
          isActive: editing.isActive,
        })
        toast.success(t('toast.tableUpdated'))
      } else {
        await window.api.tables.create({
          businessId: activeBusinessId,
          name: trimmed,
          seats: seatsValue,
        })
        toast.success(t('toast.tableCreated'))
      }
      setOpen(false)
      await refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('toast.actionFailed'))
    } finally {
      setSaving(false)
    }
  }

  const filters: Array<{ id: FloorFilter; label: string; count: number }> = [
    { id: 'all', label: t('tables.filterAll'), count: summary.total },
    { id: 'free', label: t('tables.free'), count: summary.free },
    { id: 'occupied', label: t('tables.occupied'), count: summary.occupied },
    { id: 'inactive', label: t('common.inactive'), count: summary.inactive },
  ]

  return (
    <div>
      <PageHeader
        eyebrow={t('dashboard.eyebrowTables')}
        title={t('dashboard.tables')}
        description={t('dashboard.tablesDesc')}
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            {t('tables.add')}
          </Button>
        }
      />

      {loading ? <p className="mb-4 text-sm text-ink-muted">{t('common.loading')}</p> : null}

      {tables.length > 0 ? (
        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card title={t('tables.filterAll')}>
            <p className="text-xl font-bold text-ink">{summary.total}</p>
          </Card>
          <Card title={t('tables.free')} accent="success">
            <p className="text-xl font-bold text-ink">{summary.free}</p>
          </Card>
          <Card title={t('tables.occupied')} accent="warning">
            <p className="text-xl font-bold text-ink">{summary.occupied}</p>
          </Card>
          <Card title={t('common.inactive')}>
            <p className="text-xl font-bold text-ink">{summary.inactive}</p>
          </Card>
        </div>
      ) : null}

      <Card title={t('tables.floor')} description={t('tables.floorDesc')}>
        {tables.length === 0 ? (
          <EmptyState title={t('empty.noTables')} description={t('empty.noTablesDesc')} />
        ) : (
          <div className="space-y-4">
            <div
              className="flex flex-wrap gap-1.5 rounded-lg border border-line/80 bg-surface-muted/40 p-1"
              role="tablist"
              aria-label={t('tables.floor')}
            >
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.id}
                  onClick={() => setFilter(item.id)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-pos',
                    filter === item.id
                      ? 'bg-brand-primary text-brand-on-primary shadow-glow'
                      : 'text-ink-muted hover:bg-brand-tint/60 hover:text-brand-primary',
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[11px] tabular-nums',
                      filter === item.id
                        ? 'bg-brand-on-primary/15 text-brand-on-primary'
                        : 'bg-surface-raised text-ink-subtle',
                    )}
                  >
                    {item.count}
                  </span>
                </button>
              ))}
            </div>

            {visibleTables.length === 0 ? (
              <EmptyState
                title={t('empty.noTablesInFilter')}
                description={t('empty.noTablesInFilterDesc')}
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {visibleTables.map((table) => {
                  const status: 'free' | 'occupied' | 'inactive' = !table.isActive
                    ? 'inactive'
                    : table.occupied
                      ? 'occupied'
                      : 'free'
                  return (
                    <div
                      key={table.id}
                      className={cn(
                        'relative overflow-hidden rounded-lg border p-4 shadow-soft',
                        status === 'inactive' && 'border-line/70 bg-surface-muted/50 opacity-80',
                        status === 'occupied' &&
                          'border-warning/35 bg-gradient-to-br from-warning-soft/55 to-surface-raised',
                        status === 'free' &&
                          'border-success/30 bg-gradient-to-br from-success-soft/45 to-surface-raised',
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-lg font-bold tracking-tight text-ink">
                              {table.name}
                            </p>
                            <Badge
                              tone={
                                status === 'occupied'
                                  ? 'warning'
                                  : status === 'free'
                                    ? 'success'
                                    : 'neutral'
                              }
                            >
                              {status === 'inactive'
                                ? t('common.inactive')
                                : status === 'occupied'
                                  ? t('tables.occupied')
                                  : t('tables.free')}
                            </Badge>
                          </div>
                          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-muted">
                            <Users className="size-3.5 shrink-0" aria-hidden />
                            {table.seats != null
                              ? t('tables.seatsCount', { count: table.seats })
                              : t('tables.seatsUnset')}
                          </p>
                        </div>
                        <RowActionsMenu
                          actions={[
                            {
                              id: 'edit',
                              label: t('common.edit'),
                              icon: <Pencil className="size-4" />,
                              onSelect: () => openEdit(table),
                            },
                            {
                              id: 'toggle',
                              label: table.isActive
                                ? t('common.deactivate')
                                : t('common.activate'),
                              icon: <Power className="size-4" />,
                              danger: table.isActive,
                              onSelect: () => void toggleActive(table),
                            },
                          ]}
                        />
                      </div>

                      <div className="mt-4 flex items-end justify-between gap-3">
                        <div
                          className={cn(
                            'grid size-12 place-items-center rounded-lg',
                            status === 'occupied' && 'bg-warning-soft text-warning',
                            status === 'free' && 'bg-success-soft text-success',
                            status === 'inactive' && 'bg-surface-muted text-ink-subtle',
                          )}
                          aria-hidden
                        >
                          <Armchair className="size-5" />
                        </div>
                        {status === 'occupied' ? (
                          <div className="text-end">
                            <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                              {t('tables.openTicket')}
                            </p>
                            <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">
                              {formatMoney(table.openTicketTotal)}
                            </p>
                          </div>
                        ) : (
                          <p className="text-sm text-ink-muted">
                            {status === 'free' ? t('tables.readyToSeat') : t('tables.hiddenFromPos')}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? t('tables.edit') : t('tables.add')}
        footer={
          <div className="flex w-full flex-col-reverse justify-end gap-2 sm:flex-row">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={saving}>
              {t('common.cancel')}
            </Button>
            <Button type="button" loading={saving} onClick={() => void save()}>
              {t('common.save')}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <TextField
            label={t('tables.name')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextField
            label={t('tables.seats')}
            type="number"
            min={0}
            value={seats}
            onChange={(e) => setSeats(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  )
}
