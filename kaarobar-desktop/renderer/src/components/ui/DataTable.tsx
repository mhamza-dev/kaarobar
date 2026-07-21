import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Inbox, Search, X } from "lucide-react";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "left" | "center" | "right";
  width?: string | number;
  sticky?: "left" | "right";
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  height?: string | number;
  /** Max scroll height. Table grows with content until this limit. Default `28rem`. */
  maxHeight?: string | number;
  emptyTitle?: string;
  emptyBody?: string;
  className?: string;
  tableClassName?: string;
  stickyHeader?: boolean;
  loading?: boolean;
  striped?: boolean;
  dense?: boolean;
  toolbar?: ReactNode;
  showCount?: boolean;
  countLabel?: (visible: number, total: number) => string;
  onRowClick?: (row: T, index: number) => void;
  /** Show a search field that filters rows client-side. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Build the searchable string for a row. Required when `searchable` is true. */
  getSearchText?: (row: T) => string;
};

function toCssSize(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

const alignClass = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

function SkeletonRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-border">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3.5">
              <div
                className="h-3.5 animate-pulse rounded-md bg-bg-tertiary"
                style={{ width: `${55 + ((r + c) % 4) * 10}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function TableEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-md border border-border bg-bg-tertiary text-muted">
        <Inbox className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <p className="text-sm font-semibold text-heading">{title}</p>
      {body ? (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-body">{body}</p>
      ) : null}
    </div>
  );
}

export default function DataTable<T>({
  columns,
  data,
  rowKey,
  height,
  maxHeight = "28rem",
  emptyTitle = "No rows",
  emptyBody,
  className = "",
  tableClassName = "",
  stickyHeader = true,
  loading = false,
  striped = true,
  dense = false,
  toolbar,
  showCount,
  countLabel = (visible, total) =>
    visible === total
      ? `${total} row${total === 1 ? "" : "s"}`
      : `${visible} of ${total} rows`,
  onRowClick,
  searchable = false,
  searchPlaceholder = "Search…",
  getSearchText,
}: DataTableProps<T>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!searchable) return data;
    const q = query.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) => {
      const text = (getSearchText?.(row) ?? "").toLowerCase();
      return text.includes(q);
    });
  }, [data, searchable, query, getSearchText]);

  const scrollStyle: CSSProperties = {
    ...(height !== undefined ? { height: toCssSize(height) } : {}),
    maxHeight: toCssSize(maxHeight),
  };

  const cellPad = dense ? "px-3 py-2" : "px-4 py-3";
  const displayCount = showCount ?? (!loading && data.length > 0);
  const showToolbar = Boolean(toolbar) || searchable;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm ${className}`}
    >
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg-secondary px-4 py-3">
          {searchable ? (
            <label className="relative min-w-[12rem] flex-1 max-w-md">
              <span className="sr-only">Search</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-9 text-sm text-heading outline-none transition placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand-soft"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-bg-hover hover:text-heading"
                  onClick={() => setQuery("")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </label>
          ) : (
            <div />
          )}
          {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
        </div>
      ) : null}

      <div
        className="min-h-0 overflow-x-auto overflow-y-auto overscroll-contain"
        style={scrollStyle}
      >
        <table
          className={`w-full min-w-max border-collapse text-left text-sm ${tableClassName}`}
        >
          <thead
            className={
              stickyHeader
                ? "sticky top-0 z-10 border-b border-border bg-bg-secondary/95 backdrop-blur-sm"
                : "border-b border-border bg-bg-secondary"
            }
          >
            <tr>
              {columns.map((col) => (
                <th
                  key={col.id}
                  scope="col"
                  className={`whitespace-nowrap ${cellPad} text-[11px] font-bold uppercase tracking-[0.08em] text-muted ${
                    alignClass[col.align ?? "left"]
                  } ${
                    col.sticky === "left"
                      ? "sticky left-0 z-[11] bg-bg-secondary"
                      : col.sticky === "right"
                        ? "sticky right-0 z-[11] bg-bg-secondary"
                        : ""
                  } ${col.headerClassName ?? ""}`}
                  style={
                    col.width !== undefined
                      ? { width: toCssSize(col.width), minWidth: toCssSize(col.width) }
                      : undefined
                  }
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <SkeletonRows cols={columns.length} />
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>
                  <TableEmpty
                    title={
                      query.trim()
                        ? "No matches"
                        : emptyTitle
                    }
                    body={
                      query.trim()
                        ? `Nothing matched “${query.trim()}”. Try another term.`
                        : emptyBody
                    }
                  />
                </td>
              </tr>
            ) : (
              filtered.map((row, index) => (
                <tr
                  key={rowKey(row, index)}
                  className={`group text-heading transition-colors ${
                    striped && index % 2 === 1 ? "bg-bg-tertiary/40" : "bg-card"
                  } ${
                    onRowClick
                      ? "cursor-pointer hover:bg-brand-light"
                      : "hover:bg-bg-hover/80"
                  }`}
                  onClick={
                    onRowClick ? () => onRowClick(row, index) : undefined
                  }
                >
                  {columns.map((col) => (
                    <td
                      key={col.id}
                      className={`${cellPad} align-middle ${
                        alignClass[col.align ?? "left"]
                      } ${
                        col.sticky === "left"
                          ? "sticky left-0 z-[1] bg-inherit"
                          : col.sticky === "right"
                            ? "sticky right-0 z-[1] bg-inherit"
                            : ""
                      } ${col.className ?? ""}`}
                    >
                      {col.cell(row, index)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {displayCount ? (
        <div className="border-t border-border bg-bg-secondary px-4 py-2.5">
          <p className="text-xs font-medium tabular-nums text-muted">
            {countLabel(filtered.length, data.length)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
