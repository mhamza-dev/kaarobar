"use client";

import { MoreHorizontal, Plus, Star } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBranchesList, useDeleteBranch, useSetMainBranch } from "@/hooks/queries/useBranches";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import type { Branch } from "@/types/api/tenancy";

import { BranchFormDialog } from "./BranchFormDialog";

export function BranchesTable() {
  const { data, isLoading, error, refetch } = useBranchesList();
  const setMain = useSetMainBranch();
  const deleteBranch = useDeleteBranch();
  const { can } = usePermission();

  const [editing, setEditing] = useState<Branch | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Branch | null>(null);

  const canCreate = can("branch:create");
  const canEdit = can("branch:edit");
  const canArchive = can("branch:archive");
  const showActions = canEdit || canArchive;

  const columns: DataTableColumn<Branch>[] = [
    {
      key: "name",
      header: "Branch",
      render: (branch) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{branch.name}</span>
          {branch.is_main && (
            <Badge variant="secondary" className="gap-1">
              <Star className="size-3" />
              Main
            </Badge>
          )}
          {branch.is_warehouse && <Badge variant="outline">Warehouse</Badge>}
        </div>
      ),
    },
    { key: "code", header: "Code", render: (branch) => branch.code ?? "—" },
    {
      key: "city",
      header: "City",
      render: (branch) => branch.address?.city ?? "—",
    },
    { key: "phone", header: "Phone", render: (branch) => branch.phone ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (branch) => <StatusBadge status={branch.status} />,
    },
    {
      key: "actions",
      header: "",
      width: "w-12",
      align: "end",
      render: (branch) =>
        showActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${branch.name}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => {
                    setEditing(branch);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </DropdownMenuItem>
              )}
              {canEdit && !branch.is_main && (
                <DropdownMenuItem
                  onClick={async () => {
                    await setMain.mutateAsync([branch.id]);
                    toast.success(`${branch.name} is now the main branch`);
                  }}
                >
                  Set as main
                </DropdownMenuItem>
              )}
              {canArchive && !branch.is_main && (
                <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(branch)}>
                  Delete
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <>
      {canCreate && (
        <div className="mb-3 flex justify-end">
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            New branch
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(branch) => branch.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (branch) => `${branch.name} ${branch.code ?? ""}` }}
        mobileCardTitle={(branch) => branch.name}
        mobileCardSubtitle={(branch) => branch.address?.city ?? branch.code ?? ""}
        mobileCardFields={[
          { key: "phone", label: "Phone", render: (branch) => branch.phone ?? "—" },
          {
            key: "status",
            label: "Status",
            render: (branch) => <StatusBadge status={branch.status} />,
          },
        ]}
      />

      <BranchFormDialog open={formOpen} onOpenChange={setFormOpen} branch={editing} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name}?`}
        description="Stock and sales history stay attached to this branch. You can't undo this."
        confirmLabel="Delete branch"
        destructive
        loading={deleteBranch.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteBranch.mutateAsync([pendingDelete.id]);
            toast.success("Branch deleted");
            setPendingDelete(null);
          } catch {
            // The hook toasted; keep the dialog open so the user can retry.
          }
        }}
      />
    </>
  );
}
