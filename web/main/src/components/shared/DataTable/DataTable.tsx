"use client";

import { Inbox, Loader2, Search, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

import { filterRows, hasActiveFilters } from "./filtering";
import type {
  DataTableColumn,
  DataTableFilter,
  DataTableFilterState,
  DataTableSearch,
} from "./types";

export type { DataTableColumn, DataTableFilter, DataTableSearch } from "./types";

const ALIGN_CLASSES = {
  start: "text-left",
  center: "text-center",
  end: "text-right",
} as const;

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;

  /** First-load state — renders skeleton rows instead of an empty table. */
  loading?: boolean;
  error?: { message: string } | null;
  onRetry?: () => void;
  empty?: ReactNode;

  // Cursor pagination. There is no page N and no total: the backend returns
  // `has_more` + `next_cursor` and nothing else, so the only honest control
  // is "load more".
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  /** Page size, surfaced as a picker when `onPageSizeChange` is given. */
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageSizeChange?: (size: number) => void;

  /**
   * Client-side search over loaded rows. For a large dataset pass
   * `serverSearch` instead and send the query to the backend.
   */
  search?: DataTableSearch<T>;
  /** Controlled search box whose value the caller sends to the backend. */
  serverSearch?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  filters?: DataTableFilter<T>[];

  selectable?: boolean;
  isRowSelectable?: (row: T) => boolean;
  bulkActions?: (context: { rows: T[]; keys: string[]; clear: () => void }) => ReactNode;

  onRowClick?: (row: T) => void;
  /** Drop the outer border when the table sits inside a card. */
  embedded?: boolean;
  className?: string;

  // Below `md` the table collapses into a card per row. Without
  // `mobileCardTitle` the table simply scrolls horizontally instead.
  mobileCardTitle?: (row: T) => ReactNode;
  mobileCardSubtitle?: (row: T) => ReactNode;
  mobileCardFields?: Array<{ key: string; label: ReactNode; render: (row: T) => ReactNode }>;
  mobileCardActions?: (row: T) => ReactNode;
};

const DEFAULT_PAGE_SIZE_OPTIONS = [25, 50, 100];

/** A filter's choices; a yes/no filter gets its two. */
function filterOptions(filter: {
  type?: string;
  options?: Array<{ value: string; label: string }>;
}) {
  return filter.type === "boolean"
    ? [
        { value: "true", label: "Yes" },
        { value: "false", label: "No" },
      ]
    : (filter.options ?? []);
}

const ROW_INTERACTIVE_CLASSES =
  "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring";

/** Controls that do their own thing when clicked inside a clickable row. */
const INTERACTIVE_SELECTOR =
  "button, a, input, select, textarea, label, [role=menuitem], [role=checkbox], [role=switch]";

/**
 * Makes a clickable row reachable without a mouse: focusable, and opened
 * with Enter or Space like a button. A click or key on something inside
 * the row (a checkbox, an Edit button, a link) is left to that control —
 * only one aimed at the row itself opens it, so a row can carry its own
 * quick actions and still open a detail view.
 */
function rowActivation<T>(onRowClick: ((row: T) => void) | undefined, row: T) {
  if (!onRowClick) return {};
  return {
    tabIndex: 0,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      const control = (event.target as HTMLElement).closest(INTERACTIVE_SELECTOR);
      if (control && control !== event.currentTarget && event.currentTarget.contains(control)) {
        return;
      }
      onRowClick(row);
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.target !== event.currentTarget) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onRowClick(row);
      }
    },
  };
}

/**
 * The list primitive every domain screen composes — adapted from
 * `desktop/local`'s `Table<T>` (render-prop columns, `rowKey`, selection by
 * key, mobile-card degrade, `embedded`, `bulkActions`) for the backend's
 * **cursor pagination**.
 *
 * Two consequences of cursors worth knowing before using this:
 *
 * 1. There is no page N, no total count and no jumping backwards — the
 *    footer is "load more", and `pageSizeOptions` defaults smaller than
 *    desktop's because re-fetching from the first cursor is the only way to
 *    change it.
 * 2. **`search` and `filters` narrow only the rows already fetched.** On a
 *    dataset larger than the loaded pages that is a misleading answer, so
 *    those screens pass `serverSearch` (and real query params) instead and
 *    let the backend do it.
 *
 * Selection is keyed by `rowKey`, never by index, so a row picked before a
 * search is still picked after it — including rows the current filter hides,
 * which is why `bulkActions` receives the selected rows rather than reading
 * the visible ones. Unlike desktop's table the bulk bar sits *below* the
 * toolbar rather than replacing it, so search and filters stay reachable
 * while a selection is being assembled across several queries.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  hasMore,
  loadingMore,
  onLoadMore,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageSizeChange,
  search,
  serverSearch,
  filters,
  selectable,
  isRowSelectable,
  bulkActions,
  onRowClick,
  embedded,
  className,
  mobileCardTitle,
  mobileCardSubtitle,
  mobileCardFields,
  mobileCardActions,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");
  const [filterState, setFilterState] = useState<DataTableFilterState>({});
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const visibleRows = useMemo(
    () =>
      search || filters?.length ? filterRows({ rows, query, search, filterState, filters }) : rows,
    [rows, query, search, filterState, filters],
  );

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedSet.has(rowKey(row))),
    [rows, selectedSet, rowKey],
  );

  const selectableVisible = useMemo(
    () => (isRowSelectable ? visibleRows.filter(isRowSelectable) : visibleRows),
    [visibleRows, isRowSelectable],
  );
  const allVisibleSelected =
    selectableVisible.length > 0 && selectableVisible.every((row) => selectedSet.has(rowKey(row)));

  const clearSelection = () => setSelectedKeys([]);

  const toggleRow = (key: string) =>
    setSelectedKeys((keys) =>
      keys.includes(key) ? keys.filter((existing) => existing !== key) : [...keys, key],
    );

  const toggleAllVisible = () => {
    const visibleKeys = selectableVisible.map(rowKey);
    setSelectedKeys((keys) =>
      allVisibleSelected
        ? keys.filter((key) => !visibleKeys.includes(key))
        : Array.from(new Set([...keys, ...visibleKeys])),
    );
  };

  const showToolbar = !!search || !!serverSearch || !!filters?.length;
  const filtersActive = hasActiveFilters(filterState);
  const searchValue = serverSearch ? serverSearch.value : query;
  const showingSubset = !serverSearch && visibleRows.length !== rows.length;

  return (
    <div
      className={cn(
        "flex flex-col",
        !embedded && "rounded-xl border border-border bg-card",
        className,
      )}
    >
      {showToolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
          {(search || serverSearch) && (
            <div className="relative min-w-48 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(event) =>
                  serverSearch
                    ? serverSearch.onChange(event.target.value)
                    : setQuery(event.target.value)
                }
                placeholder={
                  serverSearch?.placeholder ?? search?.placeholder ?? "Search loaded rows…"
                }
                className="pl-8"
                aria-label="Search"
              />
            </div>
          )}

          {filters?.map((filter) => (
            <Select
              key={filter.id}
              items={[{ value: "", label: `${filter.label}: Any` }, ...filterOptions(filter)]}
              value={filterState[filter.id] ?? ""}
              onValueChange={(value: string | null) =>
                setFilterState((state) => ({ ...state, [filter.id]: value ?? "" }))
              }
            >
              <SelectTrigger className="w-auto min-w-36" aria-label={filter.label}>
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{filter.label}: Any</SelectItem>
                {filterOptions(filter).map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {(filtersActive || (!serverSearch && query)) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setFilterState({});
              }}
            >
              <X className="size-3.5" />
              Clear
            </Button>
          )}
        </div>
      )}

      {selectable && selectedKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/50 p-2">
          <span className="text-sm font-medium">{selectedKeys.length} selected</span>
          <div className="ml-auto flex items-center gap-2">
            {bulkActions?.({ rows: selectedRows, keys: selectedKeys, clear: clearSelection })}
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Clear
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <EmptyState
          title="Couldn't load this list"
          description={error.message}
          action={
            onRetry && (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            )
          }
        />
      ) : loading ? (
        <div className="flex flex-col gap-2 p-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">Loading…</span>
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-full" />
          ))}
        </div>
      ) : visibleRows.length === 0 ? (
        (empty ?? (
          <EmptyState
            icon={Inbox}
            title={rows.length === 0 ? "Nothing here yet" : "No matches"}
            description={
              rows.length === 0
                ? undefined
                : "No loaded rows match your search. Try loading more, or narrowing on the server."
            }
          />
        ))
      ) : (
        <>
          {/* Desktop: a real table. */}
          <div className={cn("overflow-x-auto", mobileCardTitle && "hidden md:block")}>
            <Table>
              <TableHeader>
                <TableRow>
                  {selectable && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allVisibleSelected}
                        onCheckedChange={toggleAllVisible}
                        aria-label="Select all rows"
                      />
                    </TableHead>
                  )}
                  {columns.map((column) => (
                    <TableHead
                      key={column.key}
                      className={cn(column.width, ALIGN_CLASSES[column.align ?? "start"])}
                    >
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.map((row) => {
                  const key = rowKey(row);
                  const selected = selectedSet.has(key);
                  const selectableRow = isRowSelectable ? isRowSelectable(row) : true;

                  return (
                    <TableRow
                      key={key}
                      data-state={selected ? "selected" : undefined}
                      {...rowActivation(onRowClick, row)}
                      className={onRowClick ? ROW_INTERACTIVE_CLASSES : undefined}
                    >
                      {selectable && (
                        <TableCell onClick={(event) => event.stopPropagation()}>
                          <Checkbox
                            checked={selected}
                            disabled={!selectableRow}
                            onCheckedChange={() => toggleRow(key)}
                            aria-label="Select row"
                          />
                        </TableCell>
                      )}
                      {columns.map((column) => (
                        <TableCell
                          key={column.key}
                          className={cn(ALIGN_CLASSES[column.align ?? "start"], column.className)}
                        >
                          {column.render(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: one card per row, opt-in via `mobileCardTitle`. */}
          {mobileCardTitle && (
            <div className="flex flex-col gap-2 p-2 md:hidden">
              {visibleRows.map((row) => {
                const key = rowKey(row);
                return (
                  <div
                    key={key}
                    {...rowActivation(onRowClick, row)}
                    className={cn(
                      "rounded-lg border border-border p-3",
                      onRowClick && ROW_INTERACTIVE_CLASSES,
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        {selectable && (
                          <Checkbox
                            checked={selectedSet.has(key)}
                            disabled={isRowSelectable ? !isRowSelectable(row) : false}
                            onCheckedChange={() => toggleRow(key)}
                            aria-label="Select row"
                            className="mt-0.5"
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium">{mobileCardTitle(row)}</p>
                          {mobileCardSubtitle && (
                            <p className="text-xs text-muted-foreground">
                              {mobileCardSubtitle(row)}
                            </p>
                          )}
                        </div>
                      </div>
                      {mobileCardActions && (
                        <div onClick={(event) => event.stopPropagation()}>
                          {mobileCardActions(row)}
                        </div>
                      )}
                    </div>
                    {mobileCardFields && mobileCardFields.length > 0 && (
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
                        {mobileCardFields.map((field) => (
                          <div key={field.key} className="flex flex-col">
                            <dt className="text-xs text-muted-foreground">{field.label}</dt>
                            <dd className="text-sm">{field.render(row)}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {(hasMore || onPageSizeChange || showingSubset) && !loading && !error && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-2">
          <p className="text-xs text-muted-foreground">
            {showingSubset
              ? `Showing ${visibleRows.length} of ${rows.length} loaded`
              : `${rows.length} loaded`}
            {hasMore && " — more available"}
          </p>
          <div className="flex items-center gap-2">
            {onPageSizeChange && (
              <Select
                items={pageSizeOptions.map((option) => ({
                  value: String(option),
                  label: `${option} / page`,
                }))}
                value={String(pageSize ?? pageSizeOptions[0])}
                onValueChange={(value: string | null) => onPageSizeChange(Number(value))}
              >
                <SelectTrigger size="sm" className="w-auto" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {pageSizeOptions.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option} / page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {hasMore && onLoadMore && (
              <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
                {loadingMore && <Loader2 className="size-3.5 animate-spin" />}
                Load more
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
