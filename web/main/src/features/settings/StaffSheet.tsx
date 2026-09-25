"use client";

import { Form, Formik } from "formik";
import { Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranchesList } from "@/hooks/queries/useBranches";
import { usePermissionCatalogue } from "@/hooks/queries/useRoles";
import {
  useDeleteStaffGrant,
  usePutStaffGrant,
  useRemoveStaff,
  useSetStaffPin,
  useSetStaffStatus,
  useStaffMember,
  useUpdateStaff,
} from "@/hooks/queries/useStaff";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StaffMember } from "@/types/api/staffing";

import { StaffBranchesDialog } from "./StaffBranchesDialog";
import { StaffRolesDialog } from "./StaffRolesDialog";

/**
 * One member of staff: who they are, what they can do (roles, branches and
 * any per-person overrides), and the levers on their access — suspend,
 * PIN, remove. Suspending takes effect at once: the backend revokes their
 * sign-in tokens.
 */
export function StaffSheet({ staffId, onClose }: { staffId: string | null; onClose: () => void }) {
  const { can } = usePermission();
  const { data: staff, isLoading, error, refetch } = useStaffMember(staffId);
  const { data: branches } = useBranchesList();
  const setStatus = useSetStaffStatus();
  const remove = useRemoveStaff();

  const [roles, setRoles] = useState(false);
  const [branchesOpen, setBranchesOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [removing, setRemoving] = useState(false);

  const name = staff?.user?.name ?? staff?.user?.email;
  const branchNames = (staff?.branch_ids ?? [])
    .map((id) => branches?.find((branch) => branch.id === id)?.name)
    .filter(Boolean);

  return (
    <>
      <DetailSheet
        open={!!staffId}
        onOpenChange={(open) => !open && onClose()}
        eyebrow={staff?.job_title ?? "Staff"}
        title={name ?? undefined}
        description={staff?.user?.email ?? undefined}
        status={staff && <StatusBadge status={staff.status} />}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        what="this staff member"
        actions={
          staff && (
            <div className="flex flex-wrap gap-2">
              {can("staff:assign_roles") && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setRoles(true)}>
                    Roles
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setBranchesOpen(true)}>
                    Branches
                  </Button>
                </>
              )}
              {can("staff:edit") && (
                <Button size="sm" variant="outline" onClick={() => setPinOpen(true)}>
                  {staff.has_pin ? "Change PIN" : "Set PIN"}
                </Button>
              )}
              {can("staff:deactivate") && ["active", "suspended"].includes(staff.status) && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setStatus.isPending}
                  onClick={async () => {
                    const next = staff.status === "active" ? "suspended" : "active";
                    try {
                      await setStatus.mutateAsync([staff.id, next]);
                      toast.success(
                        next === "active" ? "Reactivated" : "Suspended — signed out everywhere",
                      );
                    } catch {
                      // Toasted by the hook.
                    }
                  }}
                >
                  {staff.status === "active" ? "Suspend" : "Reactivate"}
                </Button>
              )}
              {can("staff:deactivate") && (
                <Button size="sm" variant="ghost" onClick={() => setRemoving(true)}>
                  Remove
                </Button>
              )}
            </div>
          )
        }
      >
        {staff && (
          <Tabs defaultValue="details">
            <TabsList variant="line">
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="access">Access</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="flex flex-col gap-4 pt-3">
              <DescriptionList
                items={[
                  { label: "Phone", value: staff.user?.phone },
                  { label: "Started", value: formatDate(staff.started_on) },
                  { label: "Ended", value: formatDate(staff.ended_on), hidden: !staff.ended_on },
                  { label: "Register PIN", value: staff.has_pin ? "Set" : "Not set" },
                  { label: "Joined", value: formatDateTime(staff.inserted_at) },
                ]}
              />
              {can("staff:edit") && <StaffDetailsForm staff={staff} />}
            </TabsContent>

            <TabsContent value="access" className="flex flex-col gap-4 pt-3">
              <DescriptionList
                items={[
                  {
                    label: "Roles",
                    value: staff.roles.length
                      ? staff.roles.map((role) => role.name).join(", ")
                      : "None",
                  },
                  {
                    label: "Branches",
                    value: branchNames.length ? branchNames.join(", ") : "Every branch",
                  },
                ]}
              />
              <GrantsSection staff={staff} />
            </TabsContent>
          </Tabs>
        )}
      </DetailSheet>

      {staff && (
        <>
          <StaffRolesDialog staff={roles ? staff : null} onOpenChange={setRoles} />
          <StaffBranchesDialog staff={branchesOpen ? staff : null} onOpenChange={setBranchesOpen} />
          <PinDialog staff={staff} open={pinOpen} onOpenChange={setPinOpen} />
          <ConfirmDialog
            open={removing}
            onOpenChange={setRemoving}
            title={`Remove ${name}?`}
            description="They lose access to this business straight away. Their sales, shifts and history stay."
            confirmLabel="Remove"
            destructive
            loading={remove.isPending}
            onConfirm={async () => {
              try {
                await remove.mutateAsync([staff.id]);
                toast.success(`${name} removed`);
                setRemoving(false);
                onClose();
              } catch {
                // Toasted by the hook.
              }
            }}
          />
        </>
      )}
    </>
  );
}

function StaffDetailsForm({ staff }: { staff: StaffMember }) {
  const update = useUpdateStaff();

  return (
    <Formik
      initialValues={{
        job_title: staff.job_title ?? "",
        employee_code: staff.employee_code ?? "",
        started_on: staff.started_on ?? "",
      }}
      enableReinitialize
      onSubmit={async (values, helpers) => {
        try {
          await update.mutateAsync([
            staff.id,
            {
              job_title: values.job_title || null,
              employee_code: values.employee_code || null,
              started_on: values.started_on || null,
            },
          ]);
          toast.success("Details saved");
        } catch (error) {
          const { unmapped } = applyApiFieldErrors({ error, values, setErrors: helpers.setErrors });
          for (const message of unmapped) toast.error(message);
        }
      }}
    >
      {({ isSubmitting, dirty }) => (
        <Form className="flex flex-col gap-4 border-t border-border pt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormTextField name="job_title" label="Job title" />
            <FormTextField name="employee_code" label="Employee code" />
            <FormDatePicker name="started_on" label="Started on" />
          </div>
          <div>
            <Button type="submit" disabled={isSubmitting || !dirty}>
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Save details
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
}

function PinDialog({
  staff,
  open,
  onOpenChange,
}: {
  staff: StaffMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const setPin = useSetStaffPin();
  const [pin, setPinValue] = useState("");
  const valid = /^\d{4,8}$/.test(pin);

  const close = () => {
    setPinValue("");
    onOpenChange(false);
  };

  const save = async (value: string | null) => {
    try {
      await setPin.mutateAsync([staff.id, value]);
      toast.success(value ? "PIN set" : "PIN cleared");
      close();
    } catch {
      // Toasted by the hook — the backend also refuses trivial PINs like 1234.
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register PIN</DialogTitle>
          <DialogDescription>
            For switching cashier at the till. 4–8 digits, and not an obvious one like 1234.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="staff-pin">New PIN</Label>
          <Input
            id="staff-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(event) => setPinValue(event.target.value.replace(/\D/g, ""))}
            maxLength={8}
          />
        </div>
        <DialogFooter>
          {staff.has_pin && (
            <Button
              variant="ghost"
              className="mr-auto"
              disabled={setPin.isPending}
              onClick={() => save(null)}
            >
              Clear PIN
            </Button>
          )}
          <Button variant="outline" onClick={close}>
            Cancel
          </Button>
          <Button disabled={!valid || setPin.isPending} onClick={() => save(pin)}>
            {setPin.isPending && <Loader2 className="size-4 animate-spin" />}
            Save PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const grantSchema = Yup.object({
  permission_key: Yup.string().required("Pick a permission"),
  effect: Yup.string().oneOf(["allow", "deny"]).required(),
});

/**
 * Per-person exceptions to their roles — "can also give discounts", "can't
 * void, even though supervisors can". Rendered from the permission
 * catalogue so each key reads as its label.
 */
function GrantsSection({ staff }: { staff: StaffMember }) {
  const { can } = usePermission();
  const canGrant = can("permission:grant");
  const { data: catalogue } = usePermissionCatalogue();
  const putGrant = usePutStaffGrant();
  const deleteGrant = useDeleteStaffGrant();

  const labels = new Map(
    Object.values(catalogue?.groups ?? {})
      .flat()
      .map((permission) => [permission.key, permission.label]),
  );
  const options = (catalogue?.order ?? []).flatMap((group) =>
    (catalogue?.groups[group] ?? []).map((permission) => ({
      value: permission.key,
      label: permission.label,
      description: group,
    })),
  );
  const grants = staff.permission_grants ?? [];

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-4">
      <div>
        <h3 className="text-sm font-semibold">Exceptions to their roles</h3>
        <p className="text-xs text-muted-foreground">
          Allow or deny one permission for this person only.
        </p>
      </div>

      {grants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          None — they have exactly what their roles give.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border text-sm">
          {grants.map((grant) => (
            <li key={grant.permission_key} className="flex items-center gap-2 p-2">
              <Badge variant={grant.effect === "allow" ? "secondary" : "destructive"}>
                {grant.effect === "allow" ? "Allow" : "Deny"}
              </Badge>
              <div className="min-w-0 flex-1">
                <p>{labels.get(grant.permission_key) ?? grant.permission_key}</p>
                {(grant.reason || grant.expires_at) && (
                  <p className="text-xs text-muted-foreground">
                    {grant.reason}
                    {grant.expires_at && ` · until ${formatDateTime(grant.expires_at)}`}
                  </p>
                )}
              </div>
              {canGrant && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove exception for ${labels.get(grant.permission_key) ?? grant.permission_key}`}
                  disabled={deleteGrant.isPending}
                  onClick={async () => {
                    try {
                      await deleteGrant.mutateAsync([staff.id, grant.permission_key]);
                      toast.success("Exception removed");
                    } catch {
                      // Toasted by the hook.
                    }
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canGrant && (
        <Formik
          initialValues={{ permission_key: "", effect: "allow", reason: "" }}
          validationSchema={grantSchema}
          onSubmit={async (values, helpers) => {
            try {
              await putGrant.mutateAsync([
                staff.id,
                {
                  permission_key: values.permission_key,
                  effect: values.effect as "allow" | "deny",
                  reason: values.reason || null,
                },
              ]);
              toast.success("Exception added");
              helpers.resetForm();
            } catch (error) {
              const { unmapped } = applyApiFieldErrors({
                error,
                values,
                setErrors: helpers.setErrors,
              });
              for (const message of unmapped) toast.error(message);
            }
          }}
        >
          {({ isSubmitting }) => (
            <Form className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
              <FormSearchSelectField
                name="permission_key"
                label="Permission"
                placeholder="Pick a permission"
                searchPlaceholder="Search permissions…"
                options={options}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormSelectField
                  name="effect"
                  label="Effect"
                  options={[
                    { value: "allow", label: "Allow" },
                    { value: "deny", label: "Deny" },
                  ]}
                />
                <FormTextField name="reason" label="Why" />
              </div>
              <div>
                <Button type="submit" size="sm" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Add exception
                </Button>
              </div>
            </Form>
          )}
        </Formik>
      )}
    </section>
  );
}
