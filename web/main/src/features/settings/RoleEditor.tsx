"use client";

import { Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRole, usePermissionCatalogue, useUpdateRole } from "@/hooks/queries/useRoles";
import { toast } from "@/hooks/useToast";
import { ApiError } from "@/lib/api/errors";
import type { Role } from "@/types/api/staffing";

/** Turns `stock_transfers` into `Stock transfers`. */
function groupLabel(group: string): string {
  const spaced = group.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * The role editor — deliberately *not* forced into the Formik/Yup form
 * pattern the rest of Phase 1 uses.
 *
 * Its real input is ~140 permission keys the backend groups and orders for
 * us (`GET /roles/permissions`). Modelling that as a Formik schema would
 * mean a field per key and a validation rule that says nothing; a `Set` of
 * selected keys plus name/description is both simpler and a better fit for
 * the group-level "select all" behaviour. Name and description are still
 * validated, just inline, and backend field errors still land on the right
 * input.
 */
export function RoleEditor({
  role,
  open,
  onOpenChange,
}: {
  role?: Role | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        // Remounted per role (and per open) so the editor seeds itself from
        // that role's permissions instead of syncing prop → state in an
        // effect. "new" keys the create case, which starts empty.
        <RoleEditorBody key={role?.id ?? "new"} role={role} onOpenChange={onOpenChange} />
      )}
    </Dialog>
  );
}

function RoleEditorBody({
  role,
  onOpenChange,
}: {
  role?: Role | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: catalogue, isLoading } = usePermissionCatalogue();
  const createRole = useCreateRole();
  const updateRole = useUpdateRole();

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(role?.permissions ?? []));
  const [nameError, setNameError] = useState<string | null>(null);

  const editing = !!role;
  // A system role is defined by the backend and shared across organizations;
  // it can be inspected but never edited.
  const readOnly = role?.is_system ?? false;
  const pending = createRole.isPending || updateRole.isPending;

  const groups = useMemo(
    () =>
      (catalogue?.order ?? []).map((group) => ({
        group,
        permissions: catalogue?.groups[group] ?? [],
      })),
    [catalogue],
  );

  const toggle = (key: string) =>
    setSelected((keys) => {
      const next = new Set(keys);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleGroup = (keys: string[], allOn: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (allOn) next.delete(key);
        else next.add(key);
      }
      return next;
    });

  const submit = async () => {
    if (!name.trim()) {
      setNameError("Give the role a name");
      return;
    }

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      permissions: Array.from(selected),
    };

    try {
      if (editing) await updateRole.mutateAsync([role!.id, payload]);
      else await createRole.mutateAsync([payload]);

      toast.success(editing ? "Role updated" : "Role created");
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.fieldErrors?.name) {
        setNameError(error.fieldErrors.name);
      }
      // Anything else already toasted from the hook.
    }
  };

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader>
        <DialogTitle>
          {readOnly ? role?.name : editing ? `Edit ${role?.name}` : "New role"}
        </DialogTitle>
        <DialogDescription>
          {readOnly
            ? "This is a built-in role. Create your own role to change what's allowed."
            : "Pick everything someone with this role should be able to do."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Role name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setNameError(null);
              }}
              disabled={readOnly}
              aria-invalid={!!nameError}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={readOnly}
            />
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm font-medium">Permissions</p>
          <p className="text-xs text-muted-foreground">{selected.size} selected</p>
        </div>

        <div className="flex max-h-[45vh] flex-col gap-5 overflow-y-auto pr-1">
          {isLoading
            ? Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))
            : groups.map(({ group, permissions }) => {
                const keys = permissions.map((permission) => permission.key);
                const allOn = keys.length > 0 && keys.every((key) => selected.has(key));

                return (
                  <div key={group}>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {groupLabel(group)}
                      </p>
                      {!readOnly && (
                        <Button variant="ghost" size="xs" onClick={() => toggleGroup(keys, allOn)}>
                          {allOn ? "Clear all" : "Select all"}
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {permissions.map((permission) => (
                        <div key={permission.key} className="flex items-start gap-2">
                          <Checkbox
                            id={`perm-${permission.key}`}
                            checked={selected.has(permission.key)}
                            disabled={readOnly}
                            onCheckedChange={() => toggle(permission.key)}
                          />
                          <Label
                            htmlFor={`perm-${permission.key}`}
                            className="font-normal leading-tight"
                          >
                            {permission.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          {readOnly ? "Close" : "Cancel"}
        </Button>
        {!readOnly && (
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            {editing ? "Save role" : "Create role"}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
