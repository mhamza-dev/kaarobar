"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useArchiveSupplier, useSuppliers } from "@/hooks/queries/usePurchasing";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { Supplier } from "@/types/api/purchasing";

import { SupplierDialog } from "./SupplierDialog";

export function SuppliersTable() {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useSuppliers();
  const archive = useArchiveSupplier();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [pendingArchive, setPendingArchive] = useState<Supplier | null>(null);

  const canCreate = can("supplier:create");
  const canEdit = can("supplier:edit");
  const canArchive = can("supplier:archive");

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
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-32",
      render: (s) => (
        <div className="flex justify-end gap-1">
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setEditing(s);
                setDialogOpen(true);
              }}
            >
              Edit
            </Button>
          )}
          {canArchive && s.is_active && (
            <Button variant="ghost" size="sm" onClick={() => setPendingArchive(s)}>
              Archive
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {canCreate && (
        <div className="mb-3 flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New supplier
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(s) => s.id}
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

      <SupplierDialog open={dialogOpen} onOpenChange={setDialogOpen} supplier={editing} />

      <ConfirmDialog
        open={!!pendingArchive}
        onOpenChange={(open) => !open && setPendingArchive(null)}
        title={`Archive ${pendingArchive?.name}?`}
        description="Their purchase history stays. They won't appear when raising new orders."
        confirmLabel="Archive supplier"
        destructive
        loading={archive.isPending}
        onConfirm={async () => {
          if (!pendingArchive) return;
          try {
            await archive.mutateAsync([pendingArchive.id]);
            toast.success("Supplier archived");
            setPendingArchive(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}
