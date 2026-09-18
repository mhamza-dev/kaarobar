"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useRolesList } from "@/hooks/queries/useRoles";
import { useSetStaffRoles } from "@/hooks/queries/useStaff";
import { toast } from "@/hooks/useToast";
import type { StaffMember } from "@/types/api/staffing";

/**
 * `PUT /staff/:id/roles` — a multi-select over `GET /roles`.
 *
 * Not a Formik form: there is exactly one field, and the backend replaces
 * the role set wholesale, so local `useState` over the selected ids is the
 * honest model. Wrapping it in a schema would add ceremony without
 * validating anything.
 */
export function StaffRolesDialog({
  staff,
  onOpenChange,
}: {
  staff: StaffMember | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!staff} onOpenChange={onOpenChange}>
      {staff && (
        // Keyed by staff id so opening the dialog for someone else remounts
        // the body, which seeds its checkboxes from that person's roles.
        // That replaces syncing prop → state in an effect, which React 19
        // rightly flags as a cascading render.
        <StaffRolesDialogBody key={staff.id} staff={staff} onOpenChange={onOpenChange} />
      )}
    </Dialog>
  );
}

function StaffRolesDialogBody({
  staff,
  onOpenChange,
}: {
  staff: StaffMember;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: roles, isLoading } = useRolesList();
  const setRoles = useSetStaffRoles();
  const [selected, setSelected] = useState<string[]>(() => staff.roles.map((role) => role.id));

  const toggle = (roleId: string) =>
    setSelected((ids) =>
      ids.includes(roleId) ? ids.filter((id) => id !== roleId) : [...ids, roleId],
    );

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Roles for {staff.user?.name ?? staff.user?.email}</DialogTitle>
        <DialogDescription>
          Roles decide what this person can do. Someone with several roles gets everything all of
          them allow.
        </DialogDescription>
      </DialogHeader>

      <div className="flex max-h-80 flex-col gap-3 overflow-y-auto">
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-8" />)
          : roles?.map((role) => (
              <div key={role.id} className="flex items-start gap-2">
                <Checkbox
                  id={`role-${role.id}`}
                  checked={selected.includes(role.id)}
                  onCheckedChange={() => toggle(role.id)}
                />
                <div>
                  <Label htmlFor={`role-${role.id}`} className="font-normal">
                    {role.name}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {role.description ?? `${role.permissions.length} permissions`}
                  </p>
                </div>
              </div>
            ))}
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          disabled={setRoles.isPending}
          onClick={async () => {
            try {
              await setRoles.mutateAsync([staff.id, selected]);
              toast.success("Roles updated");
              onOpenChange(false);
            } catch {
              // Toasted by the hook; the dialog stays open to retry.
            }
          }}
        >
          {setRoles.isPending && <Loader2 className="size-4 animate-spin" />}
          Save roles
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
