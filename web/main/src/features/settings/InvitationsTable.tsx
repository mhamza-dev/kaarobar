"use client";

import { format } from "date-fns";
import { Plus } from "lucide-react";
import { useState } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useInvitationsList, useRevokeInvitation } from "@/hooks/queries/useInvitations";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import type { Invitation } from "@/types/api/staffing";

import { InviteDialog } from "./InviteDialog";

export function InvitationsTable() {
  const { data, isLoading, error, refetch } = useInvitationsList();
  const revoke = useRevokeInvitation();
  const { can } = usePermission();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<Invitation | null>(null);

  const canInvite = can("staff:invite");

  const columns: DataTableColumn<Invitation>[] = [
    {
      key: "email",
      header: "Invitee",
      render: (invitation) => (
        <div>
          <p className="font-medium">{invitation.email}</p>
          {invitation.name && <p className="text-xs text-muted-foreground">{invitation.name}</p>}
        </div>
      ),
    },
    { key: "role", header: "Role", render: (invitation) => invitation.role?.name ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (invitation) => <StatusBadge status={invitation.status} />,
    },
    {
      key: "expires_at",
      header: "Expires",
      render: (invitation) =>
        invitation.expires_at ? format(new Date(invitation.expires_at), "d MMM yyyy") : "—",
    },
    {
      key: "actions",
      header: "",
      align: "end",
      width: "w-24",
      render: (invitation) =>
        canInvite && invitation.status === "pending" ? (
          <Button variant="ghost" size="sm" onClick={() => setPendingRevoke(invitation)}>
            Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      {canInvite && (
        <div className="mb-3 flex justify-end">
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="size-4" />
            Invite staff
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(invitation) => invitation.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (invitation) => `${invitation.email} ${invitation.name ?? ""}` }}
        filters={[
          {
            id: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "pending", label: "Pending" },
              { value: "accepted", label: "Accepted" },
              { value: "revoked", label: "Revoked" },
            ],
            getValue: (invitation) => invitation.status,
          },
        ]}
        mobileCardTitle={(invitation) => invitation.email}
        mobileCardSubtitle={(invitation) => invitation.role?.name ?? ""}
        mobileCardFields={[
          {
            key: "status",
            label: "Status",
            render: (invitation) => <StatusBadge status={invitation.status} />,
          },
        ]}
      />

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} />

      <ConfirmDialog
        open={!!pendingRevoke}
        onOpenChange={(open) => !open && setPendingRevoke(null)}
        title="Revoke this invitation?"
        description={`${pendingRevoke?.email} won't be able to use their link any more.`}
        confirmLabel="Revoke"
        destructive
        loading={revoke.isPending}
        onConfirm={async () => {
          if (!pendingRevoke) return;
          try {
            await revoke.mutateAsync([pendingRevoke.id]);
            toast.success("Invitation revoked");
            setPendingRevoke(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}
