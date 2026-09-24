"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCustomers } from "@/hooks/queries/useCustomers";
import { useDebounce } from "@/hooks/useDebounce";
import { usePermission } from "@/hooks/usePermission";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { Customer } from "@/types/api/crm";

import { CustomerDialog } from "./CustomerDialog";

type Segment = "all" | "owing" | "credit";

/**
 * The customer list.
 *
 * Search and the "owing"/"on account" segments go to the backend (`q`,
 * `owing`, `credit_allowed`) — a customer book outgrows the loaded pages as
 * quickly as a catalog does, and "who owes us" answered from the first
 * fifty rows would be wrong in the way that costs money.
 */
export function CustomersTable() {
  const router = useRouter();
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";

  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState<Segment>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { rows, isLoading, error, refetch, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useCustomers({
      q: debouncedSearch || undefined,
      owing: segment === "owing" || undefined,
      credit_allowed: segment === "credit" || undefined,
    });

  const canSeeCredit = can("credit:view");

  const columns: DataTableColumn<Customer>[] = [
    {
      key: "name",
      header: "Customer",
      render: (customer) => (
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium">{customer.name}</p>
            {customer.code && <p className="text-xs text-muted-foreground">{customer.code}</p>}
          </div>
          {!customer.is_active && <Badge variant="outline">Archived</Badge>}
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (customer) => customer.phone ?? "—" },
    { key: "city", header: "City", render: (customer) => customer.city ?? "—" },
    {
      key: "credit",
      header: "Account",
      render: (customer) =>
        customer.credit_allowed ? (
          <Badge variant="secondary">
            {customer.credit_limit
              ? `Limit ${formatMoney(customer.credit_limit, currency)}`
              : "No limit"}
          </Badge>
        ) : (
          <span className="text-muted-foreground">Cash only</span>
        ),
    },
    ...(canSeeCredit
      ? [
          {
            key: "balance",
            header: "Balance",
            align: "end" as const,
            render: (customer: Customer) => (
              <span className={customer.owing ? "font-medium text-destructive" : undefined}>
                {formatMoney(customer.balance, currency)}
              </span>
            ),
          },
        ]
      : []),
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
          {(
            [
              ["all", "All"],
              ["owing", "Owing"],
              ["credit", "On account"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              role="tab"
              aria-selected={segment === value}
              size="sm"
              variant={segment === value ? "default" : "ghost"}
              onClick={() => setSegment(value)}
            >
              {label}
            </Button>
          ))}
        </div>

        {can("customer:create") && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            New customer
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(customer) => customer.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        serverSearch={{
          value: search,
          onChange: setSearch,
          placeholder: "Search name, phone or code…",
        }}
        hasMore={hasNextPage}
        loadingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        onRowClick={(customer) => router.push(`/customers/${customer.id}`)}
        mobileCardTitle={(customer) => customer.name}
        mobileCardSubtitle={(customer) => customer.phone ?? ""}
        mobileCardFields={
          canSeeCredit
            ? [
                {
                  key: "balance",
                  label: "Balance",
                  render: (customer) => formatMoney(customer.balance, currency),
                },
              ]
            : []
        }
      />

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(customer) => router.push(`/customers/${customer.id}`)}
      />
    </>
  );
}
