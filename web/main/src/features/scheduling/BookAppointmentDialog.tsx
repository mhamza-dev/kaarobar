"use client";

import { format, parseISO } from "date-fns";
import { Form, Formik } from "formik";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormDatePicker } from "@/components/forms/FormDatePicker";
import { FormSearchSelectField } from "@/components/forms/FormSearchSelectField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextField } from "@/components/forms/FormTextField";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCustomerSearch } from "@/hooks/queries/useCustomers";
import { useProductsList } from "@/hooks/queries/useProducts";
import {
  useAvailability,
  useBookAppointment,
  useResources,
  useSeatFromQueue,
} from "@/hooks/queries/useScheduling";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { QueueEntry } from "@/types/api/scheduling";

const schema = Yup.object({
  variant_id: Yup.string().required("Pick a service"),
  resource_id: Yup.string().required("Pick who's doing it"),
  starts_at: Yup.string().required("Pick a time"),
  walk_in_name: Yup.string().when("customer_id", {
    is: (value: string) => !value,
    then: (rule) => rule.trim().required("A customer or a name"),
  }),
});

/**
 * Booking a visit.
 *
 * Times come from `GET /scheduling/availability` for the chosen resource,
 * day and service length — the receptionist picks a free slot rather than
 * typing an end time, which is exactly the mistake the backend's own
 * duration rule exists to prevent. One service per booking from here; the
 * backend takes several, which a later iteration can expose.
 */
export function BookAppointmentDialog({
  open,
  onOpenChange,
  date,
  fromQueue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  /** Seating someone off the walk-in queue: who they are is already known. */
  fromQueue?: QueueEntry | null;
}) {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const book = useBookAppointment();
  const seat = useSeatFromQueue();
  const { data: resources } = useResources();
  const { rows: services } = useProductsList({ kind: "service", limit: 100 });
  const [customerQuery, setCustomerQuery] = useState("");
  const customers = useCustomerSearch(useDebounce(customerQuery, 300), open);

  const serviceOptions = services.flatMap((product) =>
    (product.variants ?? []).map((variant) => ({
      value: variant.id,
      label:
        (product.variants?.length ?? 0) > 1 ? `${product.name} — ${variant.name}` : product.name,
      description: [
        product.service_duration_minutes && `${product.service_duration_minutes} min`,
        variant.price && formatMoney(variant.price, currency),
      ]
        .filter(Boolean)
        .join(" · "),
      duration: product.service_duration_minutes ?? undefined,
    })),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {fromQueue ? `Seat ${fromQueue.name ?? "walk-in"}` : "New booking"}
          </DialogTitle>
        </DialogHeader>
        <Formik
          initialValues={{
            customer_id: fromQueue?.customer_id ?? "",
            walk_in_name: fromQueue?.name ?? "",
            walk_in_phone: fromQueue?.phone ?? "",
            variant_id: fromQueue?.variant_id ?? "",
            resource_id: fromQueue?.requested_resource_id ?? "",
            date,
            starts_at: "",
            notes: "",
          }}
          enableReinitialize
          validationSchema={schema}
          onSubmit={async (values, helpers) => {
            try {
              const payload = {
                customer_id: values.customer_id || undefined,
                walk_in_name: values.customer_id ? undefined : values.walk_in_name.trim(),
                walk_in_phone: values.customer_id ? undefined : values.walk_in_phone || undefined,
                notes: values.notes || undefined,
                services: [
                  {
                    variant_id: values.variant_id,
                    resource_id: values.resource_id,
                    starts_at: values.starts_at,
                  },
                ],
              };
              if (fromQueue) {
                await seat.mutateAsync([fromQueue.id, payload]);
                toast.success(`${fromQueue.name ?? "Walk-in"} seated`);
              } else {
                await book.mutateAsync([{ ...payload, source: "staff" }]);
                toast.success("Visit booked");
              }
              helpers.resetForm();
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
          {({ isSubmitting, values }) => (
            <Form className="flex flex-col gap-4">
              <FormSearchSelectField
                name="customer_id"
                label="Customer"
                placeholder="Walk-in (no account)"
                searchPlaceholder="Search name or phone…"
                options={(customers.data ?? []).map((customer) => ({
                  value: customer.id,
                  label: customer.name,
                  description: customer.phone ?? undefined,
                }))}
                onSearchChange={setCustomerQuery}
                loading={customers.isFetching}
              />
              {!values.customer_id && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormTextField name="walk_in_name" label="Name" />
                  <FormTextField name="walk_in_phone" label="Phone" type="tel" />
                </div>
              )}

              <FormSearchSelectField
                name="variant_id"
                label="Service"
                placeholder="Pick a service"
                options={serviceOptions}
                emptyMessage="No services in the catalog yet."
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormSelectField
                  name="resource_id"
                  label="With"
                  options={(resources ?? [])
                    .filter((resource) => resource.bookable)
                    .map((resource) => ({ value: resource.id, label: resource.name }))}
                />
                <FormDatePicker name="date" label="Day" />
              </div>
              <SlotPicker
                resourceId={values.resource_id}
                date={values.date}
                duration={
                  serviceOptions.find((option) => option.value === values.variant_id)?.duration
                }
              />
              <FormTextField name="notes" label="Notes" />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Book
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
}

/** The free starts for this resource and day, as a select bound to `starts_at`. */
function SlotPicker({
  resourceId,
  date,
  duration,
}: {
  resourceId: string;
  date: string;
  duration?: number;
}) {
  const { data: slots, isFetching } = useAvailability(
    { resource_id: resourceId || undefined, date, duration_minutes: duration },
    !!resourceId,
  );

  if (!resourceId) {
    return (
      <p className="text-xs text-muted-foreground">Pick who&apos;s doing it to see free times.</p>
    );
  }
  if (isFetching && !slots) {
    return <p className="text-xs text-muted-foreground">Finding free times…</p>;
  }
  if ((slots ?? []).length === 0) {
    return <p className="text-xs text-destructive">No free time that day.</p>;
  }

  return (
    <FormSelectField
      name="starts_at"
      label="Time"
      placeholder="Pick a time"
      options={(slots ?? []).map((slot) => ({
        value: slot.starts_at,
        label: `${format(parseISO(slot.starts_at), "HH:mm")}–${format(parseISO(slot.ends_at), "HH:mm")}`,
      }))}
    />
  );
}
