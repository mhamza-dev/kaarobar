"use client";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { useStaffList } from "@/hooks/queries/useStaff";
import { useSheetParam } from "@/hooks/useSheetParam";
import type { StaffMember } from "@/types/api/staffing";

import { StaffSheet } from "./StaffSheet";

/**
 * The plan's worked example: DataTable + the four-layer services/hooks
 * pattern. Everything done *to* a member of staff — roles, branches, PIN,
 * suspending — is in their sheet.
 */
export function StaffTable() {
  const { data, isLoading, error, refetch } = useStaffList();
  const { data: branches } = useBranchesList();
  const sheet = useSheetParam();

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
  ];

  return (
    <>
      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(staff) => staff.id}
        onRowClick={(staff) => sheet.open(staff.id)}
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

      <StaffSheet staffId={sheet.value} onClose={sheet.close} />
    </>
  );
}
