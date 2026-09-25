"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSuppliers } from "@/hooks/queries/usePurchasing";
import { useSheetParam } from "@/hooks/useSheetParam";
import { usePermission } from "@/hooks/usePermission";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { Supplier } from "@/types/api/purchasing";

import { SupplierDialog } from "./SupplierDialog";
import { SupplierSheet } from "./SupplierSheet";

export function SuppliersTable() {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useSuppliers();
  const sheet = useSheetParam();
  const [creating, setCreating] = useState(false);

  const canCreate = can("supplier:create");

  const columns: DataTableColumn<Supplier>[] = [
    {
      key: "name",
      header: "Supplier",
      render: (s) => (
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium">{s.name}</p>
            {s.contact_name && <p className="text-xs text-muted-foreground">{s.contact_name}</p>}
          </div>
          {!s.is_active && <Badge variant="outline">Archived</Badge>}
        </div>
      ),
    },
    { key: "phone", header: "Phone", render: (s) => s.phone ?? "—" },
    { key: "city", header: "City", render: (s) => s.address?.city ?? "—" },
    {
      key: "terms",
      header: "Terms",
      align: "end",
      render: (s) => (s.payment_terms_days == null ? "—" : `${s.payment_terms_days} days`),
    },
    {
      key: "balance",
      header: "Owed",
      align: "end",
      render: (s) => formatMoney(s.balance, currency),
    },
  ];

  return (
    <>
      {canCreate && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            New supplier
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(s) => s.id}
        onRowClick={(s) => sheet.open(s.id)}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (s) => `${s.name} ${s.contact_name ?? ""} ${s.phone ?? ""}` }}
        mobileCardTitle={(s) => s.name}
        mobileCardSubtitle={(s) => s.contact_name ?? ""}
        mobileCardFields={[
          { key: "owed", label: "Owed", render: (s) => formatMoney(s.balance, currency) },
        ]}
      />

      <SupplierDialog open={creating} onOpenChange={setCreating} supplier={null} />
      <SupplierSheet supplierId={sheet.value} onClose={sheet.close} />
    </>
  );
}
