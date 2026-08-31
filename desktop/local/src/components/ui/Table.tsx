import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Filter, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/cn'
import { Button } from './Button'
import { NumberField } from './NumberField'
import { SelectField } from './SelectField'
import { TextField } from './TextField'

type FilterPanelPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
}

export type TableColumn<T> = {
  key: string
  header: ReactNode
  className?: string
  /** Tailwind width utility, e.g. `w-32` or `w-[20%]` */
  width?: string
  align?: 'start' | 'center' | 'end'
  sortable?: boolean
  render: (row: T) => ReactNode
}

export type TableDateRangeValue = { from?: string; to?: string }
export type TableNumberRangeValue = { min?: number; max?: number }

export type TableFilterValue =
  | string
  | boolean
  | null
  | TableNumberRangeValue
  | TableDateRangeValue

export type TableFilterDef<T> = {
  id: string
  label: string
  type: 'text' | 'select' | 'boolean' | 'numberRange' | 'dateRange'
  options?: Array<{ value: string; label: string }>
  min?: number
  max?: number
  step?: number
  getValue: (row: T) => string | number | boolean | null | undefined
}

export type TableSearchConfig<T> = {
  placeholder?: string
  getText: (row: T) => string
}

export type TableProps<T> = {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: ReactNode
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  onSortChange?: (key: string) => void
  /** Controlled page (optional). When omitted with client pagination, Table manages page. */
  page?: number
  /** Initial / controlled page size. Enables pagination when set (or when search/filters are on). */
  pageSize?: number
  /** Choices for the per-page selector. Defaults to 10 / 25 / 50 / 100. */
  pageSizeOptions?: number[]
  /** When set with `pageSize`, page size is controlled by the parent. */
  onPageSizeChange?: (pageSize: number) => void
  /** External total for controlled/server pagination. When omitted, uses filtered row count. */
  total?: number
  onPageChange?: (page: number) => void
  search?: TableSearchConfig<T>
  filters?: TableFilterDef<T>[]
  className?: string
  /** Drop outer border/radius when nested inside a Card */
  embedded?: boolean
  /**
   * Max height for the scrollable data area (toolbar + pagination stay fixed).
   * Pass `false` to disable scrolling and grow with content.
   * Defaults to a viewport-aware height that fits the app shell.
   */
  maxHeight?: string | false
  mobileCardTitle?: (row: T) => ReactNode
  mobileCardSubtitle?: (row: T) => ReactNode
  mobileCardFields?: Array<{ key: string; label: ReactNode; render: (row: T) => ReactNode }>
  mobileCardActions?: (row: T) => ReactNode
  onRowClick?: (row: T) => void
  /**
   * Show a checkbox column and a bulk-action bar.
   *
   * Selection is keyed by `rowKey`, not by index, so it survives sorting,
   * filtering and paging — a row picked on page one is still picked after the
   * user searches for something else and comes back.
   */
  selectable?: boolean
  /** Rows that may not be picked (an already-settled invoice, say). */
  isRowSelectable?: (row: T) => boolean
  /**
   * Rendered in the bar that replaces the toolbar while rows are selected.
   * `clear` empties the selection — call it after the action succeeds.
   */
  bulkActions?: (context: { rows: T[]; keys: string[]; clear: () => void }) => ReactNode
  onSelectionChange?: (keys: string[]) => void
}

const alignClass = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
} as const

// The large sizes are here because the alternative is worse: somebody
// reconciling a month of sales, or scanning a whole stock list for one product,
// pages through forty screens instead. Rows are rendered eagerly, so 1000 is
// noticeably heavier to draw than 100 — which is why it is a choice the user
// makes for the job in hand rather than the default.
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 500, 1000]

/** Fits remaining viewport below shell header, page chrome, and card title. */
const DEFAULT_BODY_MAX_HEIGHT = 'min(36rem, calc(100dvh - 14rem))'

const EMPTY_FILTERS: TableFilterDef<unknown>[] = []

function emptyFilterValues(defs: TableFilterDef<unknown>[]): Record<string, TableFilterValue> {
  const values: Record<string, TableFilterValue> = {}
  for (const def of defs) {
    if (def.type === 'boolean') values[def.id] = null
    else if (def.type === 'numberRange' || def.type === 'dateRange') values[def.id] = {}
    else values[def.id] = ''
  }
  return values
}

function hasActiveFilters(values: Record<string, TableFilterValue>): boolean {
  return Object.values(values).some((value) => {
    if (value === null || value === '') return false
    if (typeof value === 'object' && !Array.isArray(value)) {
      const range = value as TableNumberRangeValue & TableDateRangeValue
      return (
        range.min !== undefined ||
        range.max !== undefined ||
        Boolean(range.from) ||
        Boolean(range.to)
      )
    }
    return true
  })
}

function localDateKeyFromValue(raw: string | number | boolean | null | undefined): string | null {
  if (raw === null || raw === undefined || raw === '') return null
  const d = new Date(typeof raw === 'string' || typeof raw === 'number' ? raw : String(raw))
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getHeaderText(value: ReactNode, fallback: string): ReactNode {
  if (typeof value === 'string' || typeof value === 'number') return value
  return fallback
}

function matchesFilters<T>(
  row: T,
  defs: TableFilterDef<T>[],
  values: Record<string, TableFilterValue>,
): boolean {
  for (const def of defs) {
    const active = values[def.id]
    if (active === null || active === '') continue
    if (typeof active === 'object' && !Array.isArray(active)) {
      if (def.type === 'dateRange') {
        const range = active as TableDateRangeValue
        if (!range.from && !range.to) continue
        const key = localDateKeyFromValue(def.getValue(row))
        if (!key) return false
        if (range.from && key < range.from) return false
        if (range.to && key > range.to) return false
        continue
      }
      const range = active as TableNumberRangeValue
      if (range.min === undefined && range.max === undefined) continue
      const raw = def.getValue(row)
      const num = typeof raw === 'number' ? raw : Number(raw)
      if (Number.isNaN(num)) return false
      if (range.min !== undefined && num < range.min) return false
      if (range.max !== undefined && num > range.max) return false
      continue
    }
    const raw = def.getValue(row)
    if (def.type === 'boolean') {
      if (Boolean(raw) !== active) return false
      continue
    }
    const haystack = String(raw ?? '').toLowerCase()
    const needle = String(active).toLowerCase()
    if (def.type === 'select') {
      if (haystack === needle) continue
      const parts = haystack.split(/[|,]/).map((p) => p.trim()).filter(Boolean)
      if (!parts.includes(needle)) return false
      continue
    } else if (!haystack.includes(needle)) {
      return false
    }
  }
  return true
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  empty,
  sortKey,
  sortDir = 'asc',
  onSortChange,
  page: controlledPage,
  pageSize: pageSizeProp,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  total: controlledTotal,
  onPageChange,
  search,
  filters,
  className,
  embedded = false,
  maxHeight,
  mobileCardTitle,
  mobileCardSubtitle,
  mobileCardFields,
  mobileCardActions,
  onRowClick,
  selectable = false,
  isRowSelectable,
  bulkActions,
  onSelectionChange,
}: TableProps<T>) {
  const { t } = useTranslation()
  const filterDefs = (filters ?? EMPTY_FILTERS) as TableFilterDef<T>[]
  const showToolbar = Boolean(search) || filterDefs.length > 0
  const bodyMaxHeight = maxHeight === false ? undefined : (maxHeight ?? DEFAULT_BODY_MAX_HEIGHT)
  const paginationEnabled = Boolean(search) || filterDefs.length > 0 || pageSizeProp !== undefined
  const [internalPageSize, setInternalPageSize] = useState(() => pageSizeProp ?? 10)
  const isControlledPageSize = pageSizeProp !== undefined && onPageSizeChange !== undefined
  const pageSize = paginationEnabled
    ? isControlledPageSize
      ? pageSizeProp
      : internalPageSize
    : undefined

  const [query, setQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState<Record<string, TableFilterValue>>(() =>
    emptyFilterValues(filterDefs as TableFilterDef<unknown>[]),
  )
  const [draftFilters, setDraftFilters] = useState<Record<string, TableFilterValue>>(() =>
    emptyFilterValues(filterDefs as TableFilterDef<unknown>[]),
  )
  const [filterOpen, setFilterOpen] = useState(false)
  const [filterPosition, setFilterPosition] = useState<FilterPanelPosition | null>(null)
  const [internalPage, setInternalPage] = useState(1)
  const filterTriggerRef = useRef<HTMLButtonElement>(null)
  const filterPanelRef = useRef<HTMLDivElement>(null)
  const filterPanelId = useId()

  const isControlledPage = controlledPage !== undefined && onPageChange !== undefined
  const page = isControlledPage ? controlledPage : internalPage

  const pageSizeSelectOptions = useMemo(() => {
    const sizes = new Set(pageSizeOptions)
    if (pageSize) sizes.add(pageSize)
    return [...sizes]
      .filter((n) => n > 0)
      .sort((a, b) => a - b)
      .map((n) => ({ value: String(n), label: String(n) }))
  }, [pageSizeOptions, pageSize])

  useEffect(() => {
    if (!isControlledPage) setInternalPage(1)
  }, [query, activeFilters, isControlledPage])

  function setPage(next: number) {
    if (isControlledPage) onPageChange?.(next)
    else setInternalPage(next)
  }

  function setPageSize(next: number) {
    if (isControlledPageSize) onPageSizeChange?.(next)
    else setInternalPageSize(next)
    setPage(1)
  }
  function updateFilterPosition() {
    const trigger = filterTriggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const panelWidth = Math.min(320, window.innerWidth - 16)
    const gap = 8
    const viewportPad = 8
    let left = rect.right - panelWidth
    left = Math.min(Math.max(viewportPad, left), window.innerWidth - panelWidth - viewportPad)

    const panelHeight = filterPanelRef.current?.offsetHeight ?? 280
    let top = rect.bottom + gap
    let maxHeight = Math.min(420, window.innerHeight - top - viewportPad)

    if (top + Math.min(panelHeight, maxHeight) > window.innerHeight - viewportPad) {
      const aboveTop = Math.max(viewportPad, rect.top - gap - Math.min(panelHeight, 420))
      const aboveMax = rect.top - gap - viewportPad
      if (aboveMax >= 180) {
        top = aboveTop
        maxHeight = Math.min(420, aboveMax)
      }
    }

    setFilterPosition({
      top,
      left,
      width: panelWidth,
      maxHeight: Math.max(180, maxHeight),
    })
  }

  useLayoutEffect(() => {
    if (!filterOpen) {
      setFilterPosition(null)
      return
    }
    updateFilterPosition()
    // Re-measure after paint so panel height informs flip when needed
    const frame = requestAnimationFrame(() => updateFilterPosition())
    return () => cancelAnimationFrame(frame)
  }, [filterOpen, filterDefs.length])

  useEffect(() => {
    if (!filterOpen) return
    const onPointerDown = (event: globalThis.MouseEvent) => {
      const target = event.target as Node
      if (filterTriggerRef.current?.contains(target) || filterPanelRef.current?.contains(target)) return
      setFilterOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFilterOpen(false)
    }
    const onReposition = () => updateFilterPosition()
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [filterOpen])

  const filteredRows = useMemo(() => {
    if (!paginationEnabled) return rows
    const q = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (q && search && !search.getText(row).toLowerCase().includes(q)) return false
      if (filterDefs.length > 0 && !matchesFilters(row, filterDefs, activeFilters)) return false
      return true
    })
  }, [rows, query, search, filterDefs, activeFilters, paginationEnabled])

  const totalCount = controlledTotal ?? filteredRows.length
  const totalPages =
    pageSize && totalCount > 0 ? Math.max(1, Math.ceil(totalCount / pageSize)) : pageSize ? 1 : undefined
  const safePage = totalPages ? Math.min(page, totalPages) : page

  const visibleRows = useMemo(() => {
    if (!pageSize || controlledTotal !== undefined) {
      if (!pageSize) return filteredRows
      if (controlledTotal !== undefined) return filteredRows
    }
    const start = (safePage - 1) * pageSize
    return filteredRows.slice(start, start + pageSize)
  }, [filteredRows, safePage, pageSize, controlledTotal])

  // Selection lives as a set of row keys rather than row objects: rows are
  // re-created on every parent render, so identity comparison would drop the
  // selection the moment anything upstream refetched.
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())

  const canSelect = (row: T) => !isRowSelectable || isRowSelectable(row)

  // A key that no longer matches any row — because it was deleted, or filtered
  // out by a search the user has since typed — must not stay in the selection,
  // or a bulk action would fire on rows nobody can see.
  //
  // Pruning is only safe when `rows` holds the whole set. Under server-side
  // pagination it holds one page, so anything picked on another page would be
  // quietly discarded here and the bulk action would silently do less than the
  // count promised. There, keys are kept and only the rows we can actually see
  // are handed to `bulkActions`.
  const prunable = controlledTotal === undefined
  const liveSelectedRows = useMemo(
    () => (selectable ? filteredRows.filter((row) => selectedKeys.has(rowKey(row))) : []),
    [selectable, filteredRows, selectedKeys, rowKey],
  )
  const liveSelectedKeys = useMemo(
    () => (prunable ? liveSelectedRows.map(rowKey) : [...selectedKeys]),
    [prunable, liveSelectedRows, selectedKeys, rowKey],
  )
  const selectionCount = liveSelectedKeys.length

  const clearSelection = () => setSelectedKeys(new Set())

  function toggleRow(row: T) {
    const key = rowKey(row)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // The header checkbox acts on the page in front of the user, not the whole
  // filtered set — "select all" meaning 4,000 invoices the user never looked at
  // is how bulk deletes go wrong.
  const selectablePageRows = useMemo(
    () => (selectable ? visibleRows.filter(canSelect) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectable, visibleRows, isRowSelectable],
  )
  const pageAllSelected =
    selectablePageRows.length > 0 &&
    selectablePageRows.every((row) => selectedKeys.has(rowKey(row)))
  const pageSomeSelected =
    !pageAllSelected && selectablePageRows.some((row) => selectedKeys.has(rowKey(row)))

  function togglePage() {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (pageAllSelected) {
        for (const row of selectablePageRows) next.delete(rowKey(row))
      } else {
        for (const row of selectablePageRows) next.add(rowKey(row))
      }
      return next
    })
  }

  const headerCheckboxRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (headerCheckboxRef.current) headerCheckboxRef.current.indeterminate = pageSomeSelected
  }, [pageSomeSelected])

  const lastReportedRef = useRef<string>('')
  useEffect(() => {
    if (!onSelectionChange) return
    const signature = liveSelectedKeys.join(',')
    if (signature === lastReportedRef.current) return
    lastReportedRef.current = signature
    onSelectionChange(liveSelectedKeys)
  }, [liveSelectedKeys, onSelectionChange])

  const showPagination = Boolean(pageSize)
  const from = totalCount === 0 ? 0 : (safePage - 1) * (pageSize ?? 10) + 1
  const to = Math.min(safePage * (pageSize ?? 10), totalCount)
  const filtersActive = hasActiveFilters(activeFilters)
  const resolvedMobileFields =
    mobileCardFields ??
    columns.slice(0, Math.max(1, columns.length - 1)).map((column) => ({
      key: column.key,
      label: getHeaderText(column.header, column.key),
      render: column.render,
    }))

  function openFilters() {
    setDraftFilters({ ...activeFilters })
    setFilterOpen((open) => !open)
  }

  function applyFilters() {
    setActiveFilters({ ...draftFilters })
    setFilterOpen(false)
  }

  function clearFilters() {
    const cleared = emptyFilterValues(filterDefs as TableFilterDef<unknown>[])
    setDraftFilters(cleared)
    setActiveFilters(cleared)
    setFilterOpen(false)
  }

  const filterPanel =
    filterOpen && filterPosition
      ? createPortal(
          <div
            ref={filterPanelRef}
            id={filterPanelId}
            role="dialog"
            aria-label={t('table.filter')}
            style={{
              position: 'fixed',
              top: filterPosition.top,
              left: filterPosition.left,
              width: filterPosition.width,
              maxHeight: filterPosition.maxHeight,
              zIndex: 80,
            }}
            className="flex flex-col overflow-hidden rounded-lg border border-line bg-surface-raised shadow-lift"
          >
            <div className="shrink-0 border-b border-line px-3.5 py-2.5">
              <p className="text-sm font-semibold text-ink">{t('table.filter')}</p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3.5 py-3">
              {filterDefs.map((def) => {
                if (def.type === 'boolean') {
                  return (
                    <SelectField
                      key={def.id}
                      label={def.label}
                      value={
                        draftFilters[def.id] === null
                          ? ''
                          : draftFilters[def.id] === true
                            ? 'true'
                            : 'false'
                      }
                      options={[
                        { value: '', label: t('table.anyStatus') },
                        { value: 'true', label: t('table.active') },
                        { value: 'false', label: t('table.inactive') },
                      ]}
                      onChange={(v) => {
                        setDraftFilters((prev) => ({
                          ...prev,
                          [def.id]: v === '' ? null : v === 'true',
                        }))
                      }}
                    />
                  )
                }
                if (def.type === 'select') {
                  return (
                    <SelectField
                      key={def.id}
                      label={def.label}
                      value={String(draftFilters[def.id] ?? '')}
                      options={[
                        { value: '', label: t('table.anyStatus') },
                        ...(def.options ?? []),
                      ]}
                      onChange={(v) =>
                        setDraftFilters((prev) => ({
                          ...prev,
                          [def.id]: v,
                        }))
                      }
                    />
                  )
                }
                if (def.type === 'numberRange') {
                  const range =
                    typeof draftFilters[def.id] === 'object' &&
                    draftFilters[def.id] !== null &&
                    !Array.isArray(draftFilters[def.id])
                      ? (draftFilters[def.id] as TableNumberRangeValue)
                      : {}
                  return (
                    <div key={def.id} className="space-y-2">
                      <p className="text-sm font-medium text-ink">{def.label}</p>
                      <div className="grid grid-cols-2 gap-2">
                        <NumberField
                          label={t('table.min')}
                          value={range.min === undefined ? '' : String(range.min)}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            setDraftFilters((prev) => ({
                              ...prev,
                              [def.id]: {
                                ...range,
                                min: v === '' || Number.isNaN(Number(v)) ? undefined : Number(v),
                              },
                            }))
                          }}
                        />
                        <NumberField
                          label={t('table.max')}
                          value={range.max === undefined ? '' : String(range.max)}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            setDraftFilters((prev) => ({
                              ...prev,
                              [def.id]: {
                                ...range,
                                max: v === '' || Number.isNaN(Number(v)) ? undefined : Number(v),
                              },
                            }))
                          }}
                        />
                      </div>
                    </div>
                  )
                }
                if (def.type === 'dateRange') {
                  const range =
                    typeof draftFilters[def.id] === 'object' &&
                    draftFilters[def.id] !== null &&
                    !Array.isArray(draftFilters[def.id])
                      ? (draftFilters[def.id] as TableDateRangeValue)
                      : {}
                  const fromId = `${filterPanelId}-${def.id}-from`
                  const toId = `${filterPanelId}-${def.id}-to`
                  const hasCustom = Boolean(range.from || range.to)
                  return (
                    <div key={def.id} className="space-y-2">
                      <p className="text-sm font-medium text-ink">{def.label}</p>
                      <div
                        className={cn(
                          'flex items-center gap-2 rounded-lg border bg-surface-muted/40 px-2.5 py-2',
                          hasCustom
                            ? 'border-brand-primary/35 ring-1 ring-brand-primary/15'
                            : 'border-line/80',
                        )}
                      >
                        <label className="sr-only" htmlFor={fromId}>
                          {t('table.dateFrom')}
                        </label>
                        <input
                          id={fromId}
                          type="date"
                          value={range.from ?? ''}
                          max={range.to || undefined}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            setDraftFilters((prev) => ({
                              ...prev,
                              [def.id]: {
                                ...range,
                                from: v || undefined,
                              },
                            }))
                          }}
                          className="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-1.5 text-sm text-ink outline-none focus:ring-0"
                        />
                        <span className="shrink-0 text-xs font-medium text-ink-subtle" aria-hidden>
                          –
                        </span>
                        <label className="sr-only" htmlFor={toId}>
                          {t('table.dateTo')}
                        </label>
                        <input
                          id={toId}
                          type="date"
                          value={range.to ?? ''}
                          min={range.from || undefined}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            setDraftFilters((prev) => ({
                              ...prev,
                              [def.id]: {
                                ...range,
                                to: v || undefined,
                              },
                            }))
                          }}
                          className="h-9 min-w-0 flex-1 rounded-lg border-0 bg-transparent px-1.5 text-sm text-ink outline-none focus:ring-0"
                        />
                      </div>
                    </div>
                  )
                }
                return (
                  <TextField
                    key={def.id}
                    label={def.label}
                    value={String(draftFilters[def.id] ?? '')}
                    onChange={(e) =>
                      setDraftFilters((prev) => ({
                        ...prev,
                        [def.id]: e.target.value,
                      }))
                    }
                  />
                )
              })}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-muted/40 px-3.5 py-2.5">
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                {t('table.clearFilters')}
              </Button>
              <Button type="button" size="sm" onClick={applyFilters}>
                {t('table.applyFilters')}
              </Button>
            </div>
          </div>,
          document.body,
        )
      : null

  function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false
    return Boolean(
      target.closest('button, a, input, select, textarea, [role="button"], [data-row-click-ignore="true"]'),
    )
  }

  function handleRowClick(row: T, event: MouseEvent<HTMLElement>) {
    if (!onRowClick || isInteractiveTarget(event.target)) return
    onRowClick(row)
  }

  // Once a selection is under way, clicking a row extends it rather than
  // navigating away — losing a half-built selection to a stray click is the
  // fastest way to make people distrust bulk actions.
  function handleRowActivate(row: T, event: MouseEvent<HTMLElement>) {
    if (isInteractiveTarget(event.target)) return
    if (selectable && selectionCount > 0) {
      if (canSelect(row)) toggleRow(row)
      return
    }
    handleRowClick(row, event)
  }

  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden bg-surface-raised/85 backdrop-blur-xl',
        'before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-brand-primary/20 before:to-transparent',
        embedded
          ? 'rounded-lg border border-white/40'
          : 'rounded-lg border border-white/40 shadow-soft',
        className,
      )}
    >
      {selectable && selectionCount > 0 ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-brand-primary/30 bg-brand-tint/70 px-3.5 py-3 backdrop-blur-md">
          <span className="text-sm font-semibold text-ink">
            {t('table.selectedCount', { count: selectionCount })}
          </span>
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            {bulkActions?.({
              rows: liveSelectedRows,
              keys: liveSelectedKeys,
              clear: clearSelection,
            })}
            <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
              {t('table.clearSelection')}
            </Button>
          </div>
        </div>
      ) : null}

      {showToolbar ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-white/30 bg-surface-raised/60 px-3.5 py-3.5 backdrop-blur-md">
          {search ? (
            <div className="relative min-w-[12rem] flex-1">
              <Search className="pointer-events-none absolute start-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
              <TextField
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={search.placeholder ?? t('table.searchPlaceholder')}
                aria-label={t('table.searchPlaceholder')}
                className="ps-10"
                containerClassName="w-full"
              />
            </div>
          ) : (
            <div className="flex-1" />
          )}
          {filterDefs.length > 0 ? (
            <Button
              ref={filterTriggerRef}
              type="button"
              variant="secondary"
              size="md"
              className="relative h-11 shrink-0"
              aria-label={t('table.filter')}
              aria-haspopup="dialog"
              aria-expanded={filterOpen}
              aria-controls={filterOpen ? filterPanelId : undefined}
              onClick={openFilters}
            >
              <Filter className="size-4" />
              <span>{t('table.filter')}</span>
              {filtersActive ? (
                <span className="absolute -end-0.5 -top-0.5 size-2.5 rounded-full bg-brand-primary ring-2 ring-surface-raised" />
              ) : null}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div
        className="min-h-0 overflow-auto overscroll-contain"
        style={bodyMaxHeight ? { maxHeight: bodyMaxHeight } : undefined}
      >
        <div className="hidden sm:block">
          <table className="w-full table-fixed border-collapse text-sm">
            <colgroup>
              {selectable ? <col className="w-12" /> : null}
              {columns.map((column) => (
                <col key={column.key} className={column.width} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-line/80">
                {selectable ? (
                  <th
                    scope="col"
                    className="sticky top-0 z-[1] bg-surface-muted/95 px-4 py-3.5 backdrop-blur-sm"
                  >
                    <input
                      ref={headerCheckboxRef}
                      type="checkbox"
                      className="size-4 rounded border-line accent-brand-primary"
                      aria-label={t('table.selectAllOnPage')}
                      checked={pageAllSelected}
                      disabled={selectablePageRows.length === 0}
                      onChange={togglePage}
                    />
                  </th>
                ) : null}
                {columns.map((column) => {
                  const align = column.align ?? 'start'
                  return (
                    <th
                      key={column.key}
                      scope="col"
                      className={cn(
                        'sticky top-0 z-[1] bg-surface-muted/95 px-4 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted backdrop-blur-sm',
                        alignClass[align],
                        column.className,
                      )}
                      aria-sort={
                        column.sortable && sortKey === column.key
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : undefined
                      }
                    >
                      {column.sortable && onSortChange ? (
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-lg px-1 py-0.5 hover:bg-brand-tint/60 hover:text-brand-primary"
                          onClick={() => onSortChange(column.key)}
                        >
                          {column.header}
                          {sortKey === column.key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : null}
                        </button>
                      ) : (
                        column.header
                      )}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="px-4 py-12 text-center text-ink-muted"
                  >
                    {empty ?? t('empty.noRecords')}
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={cn(
                      'border-b border-line/70 last:border-b-0 transition-colors duration-pos hover:bg-brand-tint/45',
                      onRowClick ? 'cursor-pointer' : undefined,
                      selectable && selectedKeys.has(rowKey(row)) ? 'bg-brand-tint/55' : undefined,
                    )}
                    onClick={(event) => handleRowActivate(row, event)}
                  >
                    {selectable ? (
                      <td className="px-4 py-3.5 align-middle">
                        <input
                          type="checkbox"
                          className="size-4 rounded border-line accent-brand-primary"
                          aria-label={t('table.selectRow')}
                          checked={selectedKeys.has(rowKey(row))}
                          disabled={!canSelect(row)}
                          onChange={() => toggleRow(row)}
                          onClick={(event) => event.stopPropagation()}
                        />
                      </td>
                    ) : null}
                    {columns.map((column) => {
                      const align = column.align ?? 'start'
                      return (
                        <td
                          key={column.key}
                          className={cn(
                            'px-4 py-3.5 align-middle text-ink',
                            alignClass[align],
                            column.className,
                          )}
                        >
                          {column.render(row)}
                        </td>
                      )
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="sm:hidden">
          {visibleRows.length === 0 ? (
            <div className="px-4 py-12 text-center text-ink-muted">{empty ?? t('empty.noRecords')}</div>
          ) : (
            <div className="divide-y divide-line/80">
              {visibleRows.map((row) => (
                <article
                  key={rowKey(row)}
                  className={cn(
                    'space-y-2.5 px-4 py-3.5 transition-colors duration-pos hover:bg-brand-tint/35',
                    onRowClick ? 'cursor-pointer' : undefined,
                    selectable && selectedKeys.has(rowKey(row)) ? 'bg-brand-tint/55' : undefined,
                  )}
                  onClick={(event) => handleRowActivate(row, event)}
                >
                  <div className="flex items-start justify-between gap-2">
                    {selectable ? (
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 rounded border-line accent-brand-primary"
                        aria-label={t('table.selectRow')}
                        checked={selectedKeys.has(rowKey(row))}
                        disabled={!canSelect(row)}
                        onChange={() => toggleRow(row)}
                        onClick={(event) => event.stopPropagation()}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold tracking-tight text-ink">
                        {mobileCardTitle ? mobileCardTitle(row) : resolvedMobileFields[0]?.render(row)}
                      </p>
                      {mobileCardSubtitle ? (
                        <p className="mt-0.5 text-xs text-ink-muted">{mobileCardSubtitle(row)}</p>
                      ) : null}
                    </div>
                    {mobileCardActions ? <div className="shrink-0">{mobileCardActions(row)}</div> : null}
                  </div>
                  <div className="space-y-1.5 rounded-lg bg-surface-muted/40 px-3 py-2">
                    {resolvedMobileFields.slice(mobileCardTitle ? 0 : 1).map((field) => (
                      <div key={field.key} className="flex items-start justify-between gap-3 text-sm">
                        <span className="text-ink-muted">{field.label}</span>
                        <span className="text-end font-medium text-ink">{field.render(row)}</span>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      {showPagination && totalPages ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line/80 bg-surface-muted/30 px-4 py-3 text-sm text-ink-muted">
          <span>{t('table.showing', { from, to, total: totalCount })}</span>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline whitespace-nowrap">{t('table.rowsPerPage')}</span>
              <SelectField
                aria-label={t('table.rowsPerPage')}
                value={String(pageSize)}
                options={pageSizeSelectOptions}
                onChange={(value) => setPageSize(Number(value))}
                containerClassName="w-[4.5rem]"
                className="h-8 border-line px-2.5 text-xs"
              />
            </div>
            <span className="hidden sm:inline">{t('common.pageOf', { current: safePage, total: totalPages })}</span>
            <Button variant="ghost" size="sm" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>
              {t('common.previous')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
            >
              {t('common.next')}
            </Button>
          </div>
        </div>
      ) : null}

      {filterPanel}
    </div>
  )
}
