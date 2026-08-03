"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Inbox, Printer, Search, X } from "lucide-react";
import Button from "@/components/ui/Button";
import FilterDrawer from "@/components/app/FilterDrawer";
import { useT } from "@/lib/i18n";
import {
  applyStaffListFilters,
  countAdvancedFilters,
  emptyStaffListFilters,
  type ListFilterConfig,
  type StaffListAccessors,
  type StaffListFilterState,
} from "@/lib/listFilters";
import {
  exportTablePdf,
  exportTableXls,
  printTable,
  type ExportColumn,
  type ExportRow,
} from "@/lib/tableExport";

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

export type DataTablePagination =
  | {
      mode: "client";
      pageSize?: number;
      pageSizeOptions?: number[];
    }
  | {
      mode: "server";
      page: number;
      pageSize: number;
      total: number;
      pageSizeOptions?: number[];
      onPageChange: (page: number) => void;
      onPageSizeChange: (size: number) => void;
    };

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  height?: string | number;
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
  /** Legacy client-only search (prefer filterState). */
  searchable?: boolean;
  searchPlaceholder?: string;
  getSearchText?: (row: T) => string;
  /** @deprecated Prefer in-table filterState; still rendered above chrome if passed. */
  filters?: ReactNode;
  /** Controlled list filters — search + Filters button live inside the table. */
  filterState?: StaffListFilterState;
  onFilterChange?: (next: StaffListFilterState) => void;
  filterConfig?: ListFilterConfig;
  /** Client-side filter accessors when using filterState without server filtering. */
  filterAccessors?: StaffListAccessors<T>;
  /** When true, filterState is applied client-side via filterAccessors/getSearchText. */
  clientFilter?: boolean;
  pagination?: DataTablePagination;
  exportable?: boolean;
  exportFilename?: string;
  exportTitle?: string;
  getExportRow?: (row: T) => ExportRow;
  exportColumns?: ExportColumn[];
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

const DEFAULT_PAGE_SIZES = [10, 25, 50];

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

function hasAdvancedConfig(config: ListFilterConfig): boolean {
  return (
    Boolean(config.showDateRange) ||
    Boolean(config.showAmountRange) ||
    Boolean(config.showBalanceRange) ||
    Boolean(config.showCreditLimitRange) ||
    (config.statusOptions?.length ?? 0) > 0 ||
    (config.categoryOptions?.length ?? 0) > 0 ||
    (config.paymentMethodOptions?.length ?? 0) > 0
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
  countLabel,
  onRowClick,
  searchable = false,
  searchPlaceholder,
  getSearchText,
  filters,
  filterState,
  onFilterChange,
  filterConfig = {},
  filterAccessors,
  clientFilter = true,
  pagination,
  exportable = false,
  exportFilename = "export",
  exportTitle,
  getExportRow,
  exportColumns,
}: DataTableProps<T>) {
  const t = useT();
  const [legacyQuery, setLegacyQuery] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [clientPage, setClientPage] = useState(1);
  const [clientPageSize, setClientPageSize] = useState(
    pagination?.mode === "client" ? pagination.pageSize ?? 25 : 25
  );

  const usingListFilters = Boolean(filterState && onFilterChange);

  const filtered = useMemo(() => {
    if (usingListFilters && filterState && filterAccessors && clientFilter) {
      return applyStaffListFilters(data, filterState, filterAccessors);
    }
    if (usingListFilters && filterState && getSearchText && clientFilter) {
      const q = filterState.search.trim().toLowerCase();
      if (!q) return data;
      return data.filter((row) => getSearchText(row).toLowerCase().includes(q));
    }
    if (!searchable || usingListFilters) return data;
    const q = legacyQuery.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      (getSearchText?.(row) ?? "").toLowerCase().includes(q)
    );
  }, [
    data,
    searchable,
    legacyQuery,
    getSearchText,
    usingListFilters,
    filterState,
    filterAccessors,
    clientFilter,
  ]);

  const pageSizeOptions =
    (pagination && "pageSizeOptions" in pagination
      ? pagination.pageSizeOptions
      : undefined) ?? DEFAULT_PAGE_SIZES;

  const serverMode = pagination?.mode === "server";
  const page = serverMode ? pagination.page : clientPage;
  const pageSize = serverMode ? pagination.pageSize : clientPageSize;
  const totalForPager = serverMode ? pagination.total : filtered.length;
  const pageCount = Math.max(1, Math.ceil(totalForPager / pageSize) || 1);

  const pageRows = useMemo(() => {
    if (!pagination) return filtered;
    if (serverMode) return filtered;
    const start = (clientPage - 1) * clientPageSize;
    return filtered.slice(start, start + clientPageSize);
  }, [filtered, pagination, serverMode, clientPage, clientPageSize]);

  useEffect(() => {
    if (pagination?.mode === "client" && clientPage > pageCount) {
      setClientPage(1);
    }
  }, [pagination?.mode, clientPage, pageCount]);

  const scrollStyle: CSSProperties = {
    ...(height !== undefined ? { height: toCssSize(height) } : {}),
    maxHeight: toCssSize(maxHeight),
  };

  const cellPad = dense ? "px-3 py-2" : "px-4 py-3";
  const displayCount =
    showCount ?? (!loading && (data.length > 0 || totalForPager > 0));
  const advancedCount = usingListFilters
    ? countAdvancedFilters(filterState!, filterConfig)
    : 0;
  const showFilterButton =
    usingListFilters && hasAdvancedConfig(filterConfig);
  const showChrome =
    Boolean(toolbar) ||
    searchable ||
    usingListFilters ||
    exportable;

  const defaultCountLabel = (visible: number, total: number) =>
    visible === total
      ? `${total} ${total === 1 ? t("table.row") : t("table.rows")}`
      : t("table.visibleOfTotal", { visible, total });

  const resolveExportColumns = (): ExportColumn[] => {
    if (exportColumns?.length) return exportColumns;
    return columns.map((c) => ({
      key: c.id,
      header: typeof c.header === "string" ? c.header : c.id,
    }));
  };

  const resolveExportRows = (): ExportRow[] => {
    const source = filtered;
    if (getExportRow) return source.map(getExportRow);
    return source.map((row, index) => {
      const out: ExportRow = {};
      for (const col of columns) {
        const rendered = col.cell(row, index);
        out[col.id] =
          typeof rendered === "string" || typeof rendered === "number"
            ? rendered
            : "";
      }
      return out;
    });
  };

  const runExport = async (kind: "pdf" | "xls" | "print") => {
    setExportOpen(false);
    const cols = resolveExportColumns();
    const rows = resolveExportRows();
    const title = exportTitle || exportFilename;
    if (kind === "xls") await exportTableXls(exportFilename, cols, rows);
    else if (kind === "pdf")
      await exportTablePdf(exportFilename, title, cols, rows);
    else printTable(title, cols, rows);
  };

  const goPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), pageCount);
    if (serverMode) pagination.onPageChange(clamped);
    else setClientPage(clamped);
  };

  const changePageSize = (size: number) => {
    if (serverMode) {
      pagination.onPageSizeChange(size);
    } else {
      setClientPageSize(size);
      setClientPage(1);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {filters ? <div>{filters}</div> : null}
      <div
        className={`flex flex-col overflow-hidden rounded-md border border-border bg-card shadow-sm ${className}`}
      >
        {showChrome ? (
          <div className="flex flex-col gap-2 border-b border-border bg-bg-secondary px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {usingListFilters ? (
                <label className="relative min-w-[12rem] flex-1 max-w-md">
                  <span className="sr-only">{t("common.search")}</span>
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="search"
                    value={filterState!.search}
                    onChange={(e) =>
                      onFilterChange!({ ...filterState!, search: e.target.value })
                    }
                    placeholder={searchPlaceholder || t("common.search")}
                    className="w-full rounded-md border border-border bg-card py-2 pe-9 ps-9 text-sm text-heading outline-none transition placeholder:text-muted focus:border-brand"
                  />
                  {filterState!.search ? (
                    <button
                      type="button"
                      aria-label={t("listFilters.clearSearch")}
                      className="absolute end-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-bg-hover hover:text-heading"
                      onClick={() =>
                        onFilterChange!({ ...filterState!, search: "" })
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </label>
              ) : searchable ? (
                <label className="relative min-w-[12rem] flex-1 max-w-md">
                  <span className="sr-only">Search</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="search"
                    value={legacyQuery}
                    onChange={(e) => setLegacyQuery(e.target.value)}
                    placeholder={searchPlaceholder || t("common.search")}
                    className="w-full rounded-md border border-border bg-card py-2 pl-9 pr-9 text-sm text-heading outline-none transition placeholder:text-muted focus:border-brand"
                  />
                  {legacyQuery ? (
                    <button
                      type="button"
                      aria-label={t("listFilters.clearSearch")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-bg-hover hover:text-heading"
                      onClick={() => setLegacyQuery("")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </label>
              ) : (
                <div />
              )}

              <div className="flex flex-wrap items-center gap-2">
                {showFilterButton ? (
                  <Button
                    type="button"
                    variant={advancedCount > 0 ? "primary" : "outline"}
                    size="sm"
                    onClick={() => setDrawerOpen(true)}
                  >
                    {t("listFilters.filters")}
                    {advancedCount > 0 ? (
                      <span className="ms-1 inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-brand-foreground/20 px-1.5 text-[11px] font-bold tabular-nums">
                        {advancedCount}
                      </span>
                    ) : null}
                  </Button>
                ) : null}

                {usingListFilters &&
                (advancedCount > 0 || filterState!.search.trim()) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onFilterChange!(emptyStaffListFilters())}
                  >
                    {t("listFilters.clearAll")}
                  </Button>
                ) : null}

                {exportable ? (
                  <div className="relative">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      startIcon={<Download className="h-3.5 w-3.5" />}
                      endIcon={<ChevronDown className="h-3.5 w-3.5" />}
                      onClick={() => setExportOpen((o) => !o)}
                    >
                      {t("table.export")}
                    </Button>
                    {exportOpen ? (
                      <>
                        <button
                          type="button"
                          className="fixed inset-0 z-40 cursor-default"
                          aria-label={t("common.close")}
                          onClick={() => setExportOpen(false)}
                        />
                        <div className="absolute end-0 z-50 mt-1 min-w-[10rem] overflow-hidden rounded-md border border-border bg-card py-1 shadow-lg">
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-heading hover:bg-bg-hover"
                            onClick={() => void runExport("pdf")}
                          >
                            <FileText className="h-3.5 w-3.5 text-muted" />
                            {t("table.exportPdf")}
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-heading hover:bg-bg-hover"
                            onClick={() => void runExport("xls")}
                          >
                            <FileSpreadsheet className="h-3.5 w-3.5 text-muted" />
                            {t("table.exportXls")}
                          </button>
                          <button
                            type="button"
                            className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-heading hover:bg-bg-hover"
                            onClick={() => void runExport("print")}
                          >
                            <Printer className="h-3.5 w-3.5 text-muted" />
                            {t("table.exportPrint")}
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {toolbar}
              </div>
            </div>
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
                        ? {
                            width: toCssSize(col.width),
                            minWidth: toCssSize(col.width),
                          }
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
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length}>
                    <TableEmpty
                      title={
                        (usingListFilters
                          ? filterState!.search.trim()
                          : legacyQuery.trim())
                          ? t("table.noMatches")
                          : emptyTitle
                      }
                      body={
                        (usingListFilters
                          ? filterState!.search.trim()
                          : legacyQuery.trim())
                          ? t("table.noMatchesBody")
                          : emptyBody
                      }
                    />
                  </td>
                </tr>
              ) : (
                pageRows.map((row, index) => {
                  const absoluteIndex = serverMode
                    ? (page - 1) * pageSize + index
                    : pagination
                      ? (clientPage - 1) * clientPageSize + index
                      : index;
                  return (
                    <tr
                      key={rowKey(row, absoluteIndex)}
                      className={`group text-heading transition-colors ${
                        striped && index % 2 === 1
                          ? "bg-bg-tertiary/40"
                          : "bg-card"
                      } ${
                        onRowClick
                          ? "cursor-pointer hover:bg-brand-light"
                          : "hover:bg-bg-hover/80"
                      }`}
                      onClick={
                        onRowClick ? () => onRowClick(row, absoluteIndex) : undefined
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
                          {col.cell(row, absoluteIndex)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {(displayCount || pagination) && !loading ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-bg-secondary px-4 py-2.5">
            <p className="text-xs font-medium tabular-nums text-muted">
              {(countLabel ?? defaultCountLabel)(
                pageRows.length,
                serverMode ? totalForPager : filtered.length
              )}
            </p>
            {pagination ? (
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-muted">
                  {t("table.rowsPerPage")}
                  <select
                    className="rounded-md border border-border bg-card px-2 py-1 text-xs text-heading"
                    value={pageSize}
                    onChange={(e) => changePageSize(Number(e.target.value))}
                  >
                    {pageSizeOptions.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => goPage(page - 1)}
                >
                  {t("table.prev")}
                </Button>
                <span className="text-xs tabular-nums text-muted">
                  {t("table.pageOf", { page, pages: pageCount })}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={page >= pageCount}
                  onClick={() => goPage(page + 1)}
                >
                  {t("table.next")}
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showFilterButton ? (
        <FilterDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          value={filterState!}
          onApply={onFilterChange!}
          config={filterConfig}
        />
      ) : null}
    </div>
  );
}
