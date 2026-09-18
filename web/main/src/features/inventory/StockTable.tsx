"use client";

import { AlertTriangle, MoreHorizontal } from "lucide-react";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useStockList } from "@/hooks/queries/useInventory";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { formatMoney, formatQuantity } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { StockItem } from "@/types/api/inventory";

import { StockAdjustDialog, type StockAdjustMode } from "./StockAdjustDialog";

/**
 * Stock levels per branch. Cursor-paginated and filtered server-side — a
 * stock list is one row per variant *per branch*, so it outgrows the client
 * faster than the product list does.
 */
export function StockTable() {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: branches } = useBranchesList();

  const [search, setSearch] = useState("");
  const [branchId, setBranchId] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const [adjusting, setAdjusting] = useState<StockItem | null>(null);
  const [mode, setMode] = useState<StockAdjustMode>("adjust");

  const { rows, isLoading, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useStockList({
      q: debouncedSearch || undefined,
      branch_id: branchId || undefined,
      low_stock: lowOnly || undefined,
    });

  const canAdjust = can("stock:adjust");
  const canWriteOff = can("stock:wastage");
  const canSeeValue = can("valuation:view");

  const open = (item: StockItem, next: StockAdjustMode) => {
    setMode(next);
    setAdjusting(item);
  };

  const columns: DataTableColumn<StockItem>[] = [
    {
      key: "variant",
      header: "Product",
      render: (item) => (
        <div>
          <p className="font-medium">{item.variant?.product?.name ?? item.variant?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">
            {item.variant?.sku ?? item.variant?.name ?? ""}
          </p>
        </div>
      ),
    },
    { key: "branch", header: "Branch", render: (item) => item.branch?.name ?? "—" },
    {
      key: "on_hand",
      header: "On hand",
      align: "end",
      render: (item) => (
        <div className="flex items-center justify-end gap-1.5">
          {item.below_reorder_point && (
            <AlertTriangle className="size-3.5 text-warning" aria-label="Below reorder point" />
          )}
          {formatQuantity(item.on_hand)}
        </div>
      ),
    },
    {
      key: "reserved",
      header: "Reserved",
      align: "end",
      render: (item) => formatQuantity(item.reserved),
    },
    {
      key: "available",
      header: "Available",
      align: "end",
      render: (item) => <span className="font-medium">{formatQuantity(item.available)}</span>,
    },
    ...(canSeeValue
      ? [
          {
            key: "value",
            header: "Value",
            align: "end" as const,
            render: (item: StockItem) => formatMoney(item.value, currency),
          },
        ]
      : []),
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-12",
      render: (item) =>
        canAdjust || canWriteOff ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label="Stock actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {canAdjust && (
                <DropdownMenuItem onClick={() => open(item, "adjust")}>
                  Adjust stock
                </DropdownMenuItem>
              )}
              {canWriteOff && (
                <DropdownMenuItem variant="destructive" onClick={() => open(item, "write_off")}>
                  Write off
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          value={branchId}
          onChange={(event) => setBranchId(event.target.value)}
          aria-label="Filter by branch"
          className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">All branches</option>
          {(branches ?? []).map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name}
            </option>
          ))}
        </select>

        <Button
          variant={lowOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setLowOnly((value) => !value)}
          aria-pressed={lowOnly}
        >
          <AlertTriangle className="size-3.5" />
          Low stock only
        </Button>

        {lowOnly && <Badge variant="secondary">Below reorder point</Badge>}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(item) => item.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        serverSearch={{
          value: search,
          onChange: setSearch,
          placeholder: "Search product, SKU or barcode…",
        }}
        hasMore={hasNextPage}
        loadingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        mobileCardTitle={(item) => item.variant?.product?.name ?? item.variant?.name ?? "—"}
        mobileCardSubtitle={(item) => item.branch?.name ?? ""}
        mobileCardFields={[
          {
            key: "available",
            label: "Available",
            render: (item) => formatQuantity(item.available),
          },
          { key: "on_hand", label: "On hand", render: (item) => formatQuantity(item.on_hand) },
        ]}
      />

      <StockAdjustDialog
        item={adjusting}
        mode={mode}
        onOpenChange={(open) => !open && setAdjusting(null)}
      />
    </>
  );
}
