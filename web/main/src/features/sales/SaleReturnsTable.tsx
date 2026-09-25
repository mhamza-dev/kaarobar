"use client";

import Link from "next/link";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { useSaleReturns } from "@/hooks/queries/useSales";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { SaleReturn } from "@/types/api/sales";

/** Goods taken back and money given back — all of them, or one sale's. */
export function SaleReturnsTable({ saleId, embedded }: { saleId?: string; embedded?: boolean }) {
  const fallbackCurrency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useSaleReturns({ sale_id: saleId });

  const currencyOf = (record: SaleReturn) => record.sale?.currency ?? fallbackCurrency;

  const columns: DataTableColumn<SaleReturn>[] = [
    {
      key: "number",
      header: "Return",
      render: (record) => (
        <div>
          <p className="font-medium">{record.number}</p>
          <p className="text-xs text-muted-foreground">{formatDateTime(record.returned_at)}</p>
        </div>
      ),
    },
    ...(saleId
      ? []
      : [
          {
            key: "sale",
            header: "Sale",
            render: (record: SaleReturn) =>
              record.sale ? (
                <Link
                  href={`/sales/${record.sale_id}`}
                  className="text-brand-primary underline-offset-2 hover:underline"
                >
                  {record.sale.number}
                </Link>
              ) : (
                "—"
              ),
          },
        ]),
    {
      key: "items",
      header: "Items",
      render: (record) =>
        (record.items ?? []).map((item) => `${item.name} ×${Number(item.quantity)}`).join(", ") ||
        "—",
    },
    { key: "reason", header: "Reason", render: (record) => record.reason ?? "—" },
    { key: "by", header: "By", render: (record) => record.processed_by_label ?? "—" },
    {
      key: "total",
      header: "Refunded",
      align: "end",
      render: (record) => formatMoney(record.total, currencyOf(record)),
    },
  ];

  return (
    <DataTable
      embedded={embedded}
      columns={columns}
      rows={data ?? []}
      rowKey={(record) => record.id}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      empty={
        <p className="p-6 text-center text-sm text-muted-foreground">
          {saleId ? "Nothing has been returned from this sale." : "No returns yet."}
        </p>
      }
      mobileCardTitle={(record) => record.number}
      mobileCardSubtitle={(record) => record.reason ?? ""}
      mobileCardFields={[
        {
          key: "total",
          label: "Refunded",
          render: (record) => formatMoney(record.total, currencyOf(record)),
        },
      ]}
    />
  );
}
