"use client";

import { MoreHorizontal } from "lucide-react";
import { useState } from "react";

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
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useSetStaffStatus, useStaffList } from "@/hooks/queries/useStaff";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import type { StaffMember } from "@/types/api/staffing";

import { StaffBranchesDialog } from "./StaffBranchesDialog";
import { StaffRolesDialog } from "./StaffRolesDialog";

/** The plan's worked example: DataTable + the four-layer services/hooks pattern. */
export function StaffTable() {
  const { data, isLoading, error, refetch } = useStaffList();
  const { data: branches } = useBranchesList();
  const setStatus = useSetStaffStatus();
  const { can } = usePermission();

  const [rolesFor, setRolesFor] = useState<StaffMember | null>(null);
  const [branchesFor, setBranchesFor] = useState<StaffMember | null>(null);

  // The backend splits staff administration across separate keys
  // (AccessControl.Permissions) — a supervisor may assign roles without
  // being able to deactivate anyone.
  const canAssign = can("staff:assign_roles");
  const canDeactivate = can("staff:deactivate");
  const showActions = canAssign || canDeactivate;
  const branchName = (id: string) => branches?.find((branch) => branch.id === id)?.name ?? id;

  const columns: DataTableColumn<StaffMember>[] = [
    {
      key: "name",
      header: "Name",
      render: (staff) => (
        <div>
          <p className="font-medium">{staff.user?.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{staff.user?.email}</p>
        </div>
      ),
    },
    {
      key: "job_title",
      header: "Job title",
      render: (staff) => staff.job_title ?? "—",
    },
    {
      key: "roles",
      header: "Roles",
      render: (staff) =>
        staff.roles.length === 0 ? (
          <span className="text-muted-foreground">No roles</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {staff.roles.map((role) => (
              <Badge key={role.id} variant="secondary">
                {role.name}
              </Badge>
            ))}
          </div>
        ),
    },
    {
      key: "branches",
      header: "Branches",
      render: (staff) =>
        // Empty means every branch, not none — see StaffBranchesDialog.
        staff.branch_ids.length === 0 ? (
          <span className="text-muted-foreground">All branches</span>
        ) : (
          staff.branch_ids.map(branchName).join(", ")
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (staff) => <StatusBadge status={staff.status} />,
    },
    {
      key: "actions",
      header: "",
      width: "w-12",
      align: "end",
      render: (staff) =>
        showActions ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${staff.user?.name ?? staff.user?.email}`}
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              {canAssign && (
                <DropdownMenuItem onClick={() => setRolesFor(staff)}>Assign roles</DropdownMenuItem>
              )}
              {canAssign && (
                <DropdownMenuItem onClick={() => setBranchesFor(staff)}>
                  Assign branches
                </DropdownMenuItem>
              )}
              {canDeactivate && (
                <DropdownMenuItem
                  onClick={async () => {
                    const next = staff.status === "active" ? "suspended" : "active";
                    await setStatus.mutateAsync([staff.id, next]);
                    toast.success(next === "active" ? "Staff reactivated" : "Staff suspended");
                  }}
                >
                  {staff.status === "active" ? "Suspend" : "Reactivate"}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null,
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(staff) => staff.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{
          getText: (staff) => `${staff.user?.name ?? ""} ${staff.user?.email ?? ""}`,
        }}
        filters={[
          {
            id: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "active", label: "Active" },
              { value: "suspended", label: "Suspended" },
            ],
            getValue: (staff) => staff.status,
          },
        ]}
        mobileCardTitle={(staff) => staff.user?.name ?? staff.user?.email ?? "—"}
        mobileCardSubtitle={(staff) => staff.job_title ?? ""}
        mobileCardFields={[
          {
            key: "roles",
            label: "Roles",
            render: (staff) => staff.roles.map((role) => role.name).join(", ") || "No roles",
          },
          {
            key: "status",
            label: "Status",
            render: (staff) => <StatusBadge status={staff.status} />,
          },
        ]}
      />

      <StaffRolesDialog staff={rolesFor} onOpenChange={(open) => !open && setRolesFor(null)} />
      <StaffBranchesDialog
        staff={branchesFor}
        onOpenChange={(open) => !open && setBranchesFor(null)}
      />
    </>
  );
}
