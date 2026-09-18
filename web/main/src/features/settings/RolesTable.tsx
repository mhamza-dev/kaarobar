"use client";

import { Lock, Plus } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeleteRole, useRolesList } from "@/hooks/queries/useRoles";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import type { Role } from "@/types/api/staffing";

import { RoleEditor } from "./RoleEditor";

export function RolesTable() {
  const { data, isLoading, error, refetch } = useRolesList();
  const deleteRole = useDeleteRole();
  const { can } = usePermission();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Role | null>(null);

  const canCreate = can("role:create");
  const canEdit = can("role:edit");
  const canDelete = can("role:delete");

  const openEditor = (role: Role | null) => {
    setEditing(role);
    setEditorOpen(true);
  };

  const columns: DataTableColumn<Role>[] = [
    {
      key: "name",
      header: "Role",
      render: (role) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{role.name}</span>
          {role.is_system && (
            <Badge variant="outline" className="gap-1">
              <Lock className="size-3" />
              Built-in
            </Badge>
          )}
        </div>
      ),
    },
    {
      key: "description",
      header: "Description",
      render: (role) => role.description ?? "—",
    },
    {
      key: "permissions",
      header: "Permissions",
      align: "end",
      render: (role) => role.permissions.length,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-32",
      render: (role) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEditor(role)}>
            {role.is_system || !canEdit ? "View" : "Edit"}
          </Button>
          {canDelete && !role.is_system && (
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(role)}>
              Delete
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
          <Button onClick={() => openEditor(null)}>
            <Plus className="size-4" />
            New role
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(role) => role.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (role) => `${role.name} ${role.description ?? ""}` }}
        mobileCardTitle={(role) => role.name}
        mobileCardSubtitle={(role) => role.description ?? ""}
        mobileCardFields={[
          {
            key: "permissions",
            label: "Permissions",
            render: (role) => role.permissions.length,
          },
        ]}
      />

      <RoleEditor role={editing} open={editorOpen} onOpenChange={setEditorOpen} />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={`Delete the ${pendingDelete?.name} role?`}
        description="Anyone currently using this role loses the permissions it granted."
        confirmLabel="Delete role"
        destructive
        loading={deleteRole.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await deleteRole.mutateAsync([pendingDelete.id]);
            toast.success("Role deleted");
            setPendingDelete(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}
