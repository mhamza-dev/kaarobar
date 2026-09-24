"use client";

import { Form, Formik } from "formik";
import { Loader2, MapPin, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormSwitch } from "@/components/forms/FormSwitch";
import { FormTextField } from "@/components/forms/FormTextField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAddCustomerAddress,
  useCustomerAddresses,
  useDeleteCustomerAddress,
  useUpdateCustomerAddress,
} from "@/hooks/queries/useCustomers";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { humanize } from "@/lib/format";
import { ADDRESS_KINDS, type CustomerAddress } from "@/types/api/crm";

/** Delivery and billing addresses — part of the record, so they ride on `customer:edit`. */
export function AddressesTab({ customerId, canEdit }: { customerId: string; canEdit: boolean }) {
  const { data: addresses, isLoading } = useCustomerAddresses(customerId);
  const remove = useDeleteCustomerAddress();

  const [editing, setEditing] = useState<CustomerAddress | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CustomerAddress | null>(null);

  if (isLoading) return <Skeleton className="h-24 w-full" />;

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <>
      {(addresses?.length ?? 0) === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No addresses"
          description="Add one to deliver to this customer or to print it on their invoices."
          action={
            canEdit && (
              <Button onClick={openNew}>
                <Plus className="size-4" />
                Add address
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {canEdit && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={openNew}>
                <Plus className="size-4" />
                Add address
              </Button>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {addresses!.map((address) => (
              <div key={address.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <p className="font-medium">
                    {address.label ?? humanize(address.kind ?? "address")}
                  </p>
                  {address.is_default && <Badge variant="secondary">Default</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{address.one_line}</p>
                {address.delivery_notes && (
                  <p className="mt-1 text-xs text-muted-foreground">{address.delivery_notes}</p>
                )}
                {canEdit && (
                  <div className="mt-3 flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditing(address);
                        setDialogOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingDelete(address)}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <AddressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customerId={customerId}
        address={editing}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Remove this address?"
        description={pendingDelete?.one_line ?? undefined}
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          try {
            await remove.mutateAsync([pendingDelete.id]);
            toast.success("Address removed");
            setPendingDelete(null);
          } catch {
            // Toasted by the hook.
          }
        }}
      />
    </>
  );
}

const schema = Yup.object({
  line1: Yup.string().trim().required("Enter the street address"),
  country_code: Yup.string().length(2, "Use the two-letter country code"),
});

function AddressDialog({
  open,
  onOpenChange,
  customerId,
  address,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  address: CustomerAddress | null;
}) {
  const add = useAddCustomerAddress();
  const update = useUpdateCustomerAddress();
  const editing = !!address;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit address" : "Add address"}</DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{
            label: address?.label ?? "",
            kind: address?.kind ?? "both",
            line1: address?.line1 ?? "",
            line2: address?.line2 ?? "",
            city: address?.city ?? "",
            state: address?.state ?? "",
            postal_code: address?.postal_code ?? "",
            country_code: address?.country_code ?? "",
            delivery_notes: address?.delivery_notes ?? "",
            is_default: address?.is_default ?? false,
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            const payload = Object.fromEntries(
              Object.entries(values).map(([key, value]) => [key, value === "" ? null : value]),
            ) as Partial<CustomerAddress>;

            try {
              if (editing) await update.mutateAsync([address!.id, payload]);
              else await add.mutateAsync([customerId, payload]);
              toast.success(editing ? "Address updated" : "Address added");
              onOpenChange(false);
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
            <Form className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="label" label="Label" placeholder="Home, Shop…" />
                <FormSelectField
                  name="kind"
                  label="Used for"
                  options={ADDRESS_KINDS.map((kind) => ({
                    value: kind,
                    label: kind === "both" ? "Billing and delivery" : humanize(kind),
                  }))}
                />
              </div>
              <FormTextField name="line1" label="Street address" autoFocus />
              <FormTextField name="line2" label="Address line 2" />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="city" label="City" />
                <FormTextField name="state" label="Province / state" />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormTextField name="postal_code" label="Postal code" />
                <FormTextField name="country_code" label="Country" placeholder="PK" />
              </div>
              <FormTextareaField
                name="delivery_notes"
                label="Delivery notes"
                rows={2}
                placeholder="Gate code, landmark…"
              />
              <FormSwitch name="is_default" label="Default address" />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  {editing ? "Save address" : "Add address"}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}
