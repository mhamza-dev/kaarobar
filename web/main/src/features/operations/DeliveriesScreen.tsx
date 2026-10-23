"use client";

import { Form, Formik } from "formik";
import { Bike, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import * as Yup from "yup";

import { FormNumberField } from "@/components/forms/FormNumberField";
import { FormSelectField } from "@/components/forms/FormSelectField";
import { FormTextareaField } from "@/components/forms/FormTextareaField";
import { FormTextField } from "@/components/forms/FormTextField";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadError } from "@/components/shared/LoadError";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useAssignDelivery,
  useCancelDelivery,
  useCompleteDelivery,
  useCreateDelivery,
  useDeliveries,
  useDelivery,
  useFailDelivery,
  useOpenOrders,
  usePickUpDelivery,
  useRiderBoard,
} from "@/hooks/queries/useOperations";
import { useStaffList } from "@/hooks/queries/useStaff";
import { usePermission } from "@/hooks/usePermission";
import { useSheetParam } from "@/hooks/useSheetParam";
import { toast } from "@/hooks/useToast";
import { applyApiFieldErrors } from "@/lib/api/formErrors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import { getSaleByNumber } from "@/services/sales";
import type { Delivery } from "@/types/api/operations";
import type { Sale } from "@/types/api/sales";

/**
 * What's out for delivery and with whom: the live list, each rider's
 * round (and the cash they'll bring back), and a delivery's sheet to move
 * it along — assign, picked up, delivered, or it didn't make it.
 */
export function DeliveriesScreen() {
  const sheet = useSheetParam();
  return (
    <>
      <Tabs defaultValue="live">
        <TabsList variant="line">
          <TabsTrigger value="live">Out and waiting</TabsTrigger>
          <TabsTrigger value="riders">Riders</TabsTrigger>
        </TabsList>
        <TabsContent value="live" className="pt-4">
          <LiveDeliveries onOpen={sheet.open} />
        </TabsContent>
        <TabsContent value="riders" className="pt-4">
          <RiderBoard onOpen={sheet.open} />
        </TabsContent>
      </Tabs>
      <DeliverySheet deliveryId={sheet.value} onClose={sheet.close} />
    </>
  );
}

function LateBadge({ delivery }: { delivery: Delivery }) {
  return delivery.minutes_late ? (
    <Badge variant="destructive">{delivery.minutes_late} min late</Badge>
  ) : null;
}

function LiveDeliveries({ onOpen }: { onOpen: (id: string) => void }) {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useDeliveries();

  const columns: DataTableColumn<Delivery>[] = [
    {
      key: "number",
      header: "Delivery",
      render: (delivery) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium">{delivery.number}</span>
            <LateBadge delivery={delivery} />
          </div>
          <p className="line-clamp-1 text-xs text-muted-foreground">{delivery.address}</p>
        </div>
      ),
    },
    {
      key: "promised",
      header: "Promised",
      render: (delivery) => formatDateTime(delivery.promised_at),
    },
    { key: "rider", header: "Rider", render: (delivery) => delivery.rider_label ?? "—" },
    {
      key: "status",
      header: "Status",
      render: (delivery) => <StatusBadge status={delivery.status} />,
    },
    {
      key: "fee",
      header: "Fee",
      align: "end",
      render: (delivery) => formatMoney(delivery.fee, currency),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={data ?? []}
      rowKey={(delivery) => delivery.id}
      onRowClick={(delivery) => onOpen(delivery.id)}
      loading={isLoading}
      error={error ? { message: error.message } : null}
      onRetry={() => refetch()}
      empty={<EmptyState size="sm" title={<>Nothing out for delivery.</>} />}
      mobileCardTitle={(delivery) => delivery.number}
      mobileCardSubtitle={(delivery) => delivery.address}
      mobileCardFields={[
        { key: "rider", label: "Rider", render: (delivery) => delivery.rider_label ?? "—" },
      ]}
    />
  );
}

function RiderBoard({ onOpen }: { onOpen: (id: string) => void }) {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data, isLoading, error, refetch } = useRiderBoard();

  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error) return <LoadError what="the riders" onRetry={() => refetch()} />;
  if (!data?.length) {
    return (
      <EmptyState
        icon={Bike}
        title="No rider has anything out"
        description="Assign a delivery to see it here."
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {data.map((round) => (
        <section
          key={round.rider_user_id}
          className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold">{round.rider_label ?? "Rider"}</h3>
              <p className="text-xs text-muted-foreground">
                {round.count} out{round.late_count ? ` · ${round.late_count} late` : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Cash to bring back</p>
              <p className="font-semibold tabular-nums">{formatMoney(round.cash_out, currency)}</p>
            </div>
          </div>
          <ul className="divide-y divide-border text-sm">
            {round.deliveries.map((delivery) => (
              <li key={delivery.id}>
                <button
                  type="button"
                  onClick={() => onOpen(delivery.id)}
                  className="flex w-full items-center justify-between gap-2 py-2 text-left"
                >
                  <span className="line-clamp-1">{delivery.address}</span>
                  <StatusBadge status={delivery.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function DeliverySheet({
  deliveryId,
  onClose,
}: {
  deliveryId: string | null;
  onClose: () => void;
}) {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const { data: delivery, isLoading, error, refetch } = useDelivery(deliveryId);
  const { data: staff } = useStaffList();
  const assign = useAssignDelivery();
  const pickUp = usePickUpDelivery();
  const complete = useCompleteDelivery();
  const fail = useFailDelivery();
  const cancel = useCancelDelivery();
  const [rider, setRider] = useState("");
  const [collected, setCollected] = useState("");
  const [completing, setCompleting] = useState(false);
  const [failing, setFailing] = useState(false);

  const live = !!delivery && ["pending", "assigned", "picked_up"].includes(delivery.status);
  const riders = (staff ?? [])
    .filter((member) => member.status === "active" && member.user)
    .map((member) => ({ value: member.user!.id, label: member.user!.name ?? member.user!.email }));

  const actions: WorkflowAction[] = delivery
    ? [
        {
          key: "pick-up",
          label: "Picked up",
          variant: "default",
          available: delivery.status === "assigned",
          permitted: can("delivery:update"),
          pending: pickUp.isPending,
          onAction: async () => {
            await pickUp.mutateAsync([delivery.id]);
            toast.success("On its way");
          },
        },
        {
          key: "deliver",
          label: "Delivered",
          variant: "default",
          available: delivery.status === "picked_up",
          permitted: can("delivery:update"),
          onAction: () => setCompleting(true),
        },
        {
          key: "fail",
          label: "Couldn't deliver",
          available: delivery.status === "picked_up",
          permitted: can("delivery:update"),
          onAction: () => setFailing(true),
        },
        {
          key: "cancel",
          label: "Cancel",
          variant: "destructive",
          available: ["pending", "assigned"].includes(delivery.status),
          permitted: can("delivery:update"),
          pending: cancel.isPending,
          confirm: {
            title: `Cancel ${delivery.number}?`,
            confirmLabel: "Cancel delivery",
            destructive: true,
          },
          onAction: async () => {
            await cancel.mutateAsync([delivery.id]);
            toast.success("Delivery cancelled");
          },
        },
      ]
    : [];

  return (
    <>
      <DetailSheet
        open={!!deliveryId}
        onOpenChange={(open) => !open && onClose()}
        eyebrow="Delivery"
        title={delivery?.number}
        status={
          delivery && (
            <>
              <StatusBadge status={delivery.status} />
              <LateBadge delivery={delivery} />
            </>
          )
        }
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        what="this delivery"
        actions={<WorkflowActions actions={actions} />}
      >
        {delivery && (
          <div className="flex flex-col gap-4">
            <DescriptionList
              items={[
                {
                  label: "Address",
                  value: <span className="whitespace-pre-line">{delivery.address}</span>,
                },
                { label: "Phone", value: delivery.phone },
                { label: "Customer", value: delivery.customer?.name, hidden: !delivery.customer },
                { label: "Promised", value: formatDateTime(delivery.promised_at) },
                { label: "Fee", value: formatMoney(delivery.fee, currency) },
                { label: "Rider", value: delivery.rider_label },
                {
                  label: "Picked up",
                  value: formatDateTime(delivery.picked_up_at),
                  hidden: !delivery.picked_up_at,
                },
                {
                  label: "Delivered",
                  value: formatDateTime(delivery.delivered_at),
                  hidden: !delivery.delivered_at,
                },
                {
                  label: "Cash collected",
                  value: formatMoney(delivery.collected_amount, currency),
                  hidden: !delivery.collected_amount,
                },
                {
                  label: "Why it failed",
                  value: delivery.failure_reason,
                  hidden: !delivery.failure_reason,
                },
              ]}
            />
            {delivery.delivery_notes && (
              <p className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-line">
                {delivery.delivery_notes}
              </p>
            )}
            {live && delivery.status !== "picked_up" && can("delivery:assign") && (
              <div className="flex flex-wrap items-end gap-2 border-t border-border pt-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="delivery-rider">
                    {delivery.rider_user_id ? "Give to another rider" : "Rider"}
                  </Label>
                  <Select
                    items={riders}
                    value={rider}
                    onValueChange={(value: string | null) => setRider(value ?? "")}
                  >
                    <SelectTrigger id="delivery-rider" className="w-56">
                      <SelectValue placeholder="Pick a rider" />
                    </SelectTrigger>
                    <SelectContent>
                      {riders.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  disabled={!rider || assign.isPending}
                  onClick={async () => {
                    try {
                      await assign.mutateAsync([delivery.id, rider]);
                      toast.success("Rider assigned");
                      setRider("");
                    } catch {
                      // Toasted by the hook.
                    }
                  }}
                >
                  Assign
                </Button>
              </div>
            )}
          </div>
        )}
      </DetailSheet>

      {delivery && (
        <>
          <Dialog open={completing} onOpenChange={setCompleting}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delivered</DialogTitle>
                <DialogDescription>
                  If the customer paid the rider, enter what they took.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="collected">Cash collected ({currency})</Label>
                <Input
                  id="collected"
                  inputMode="decimal"
                  value={collected}
                  onChange={(event) => setCollected(event.target.value)}
                  placeholder="0"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCompleting(false)}>
                  Back
                </Button>
                <Button
                  disabled={complete.isPending}
                  onClick={async () => {
                    try {
                      await complete.mutateAsync([delivery.id, collected || undefined]);
                      toast.success("Delivered");
                      setCompleting(false);
                      setCollected("");
                    } catch {
                      // Toasted by the hook.
                    }
                  }}
                >
                  {complete.isPending && <Loader2 className="size-4 animate-spin" />}
                  Mark delivered
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ReasonDialog
            open={failing}
            onOpenChange={setFailing}
            title="Couldn't deliver"
            description="What happened — it goes on the delivery."
            placeholder="Nobody home, wrong address…"
            confirmLabel="Record"
            destructive
            onSubmit={async (reason) => {
              await fail.mutateAsync([delivery.id, reason]);
              toast.success("Recorded as not delivered");
            }}
          />
        </>
      )}
    </>
  );
}

const schema = Yup.object({
  address_snapshot: Yup.string().trim().required("Where is it going?"),
  order_id: Yup.string().when("sale_number", {
    is: (value: string) => !value,
    then: (rule) => rule.required("Pick the order, or enter a sale number"),
  }),
});

/**
 * A delivery rides on an order (still being made up) or a sale (already
 * paid) — the backend refuses one with neither, since that's what tells
 * the rider what to carry and what to collect.
 */
export function NewDeliveryDialog() {
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [open, setOpen] = useState(false);
  const create = useCreateDelivery();
  const { data: orders } = useOpenOrders(open);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" />
        New delivery
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New delivery</DialogTitle>
            <DialogDescription>For an open order, or a sale already paid for.</DialogDescription>
          </DialogHeader>
          <Formik
            initialValues={{
              order_id: "",
              sale_number: "",
              address_snapshot: "",
              phone_snapshot: "",
              fee: "",
              promised_at: "",
              delivery_notes: "",
            }}
            validationSchema={schema}
            onSubmit={async (values, helpers) => {
              // A sale is found by its receipt number; an order is picked.
              let sale: Sale | null = null;
              if (!values.order_id && values.sale_number) {
                try {
                  sale = await getSaleByNumber(values.sale_number.trim());
                } catch {
                  helpers.setFieldError("sale_number", "No sale with that number");
                  return;
                }
              }
              const order = orders?.find((candidate) => candidate.id === values.order_id);
              try {
                await create.mutateAsync([
                  {
                    order_id: values.order_id || null,
                    sale_id: sale?.id ?? null,
                    customer_id: sale?.customer_id ?? order?.customer_id ?? null,
                    address_snapshot: values.address_snapshot,
                    phone_snapshot: values.phone_snapshot || null,
                    ...(values.fee ? { fee: String(values.fee) } : {}),
                    promised_at: values.promised_at
                      ? new Date(values.promised_at).toISOString()
                      : null,
                    delivery_notes: values.delivery_notes || null,
                  },
                ]);
                toast.success("Delivery added");
                helpers.resetForm();
                setOpen(false);
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
            {({ isSubmitting, values, setFieldValue }) => (
              <Form className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormSelectField
                    name="order_id"
                    label="Order"
                    placeholder="Pick an open order"
                    options={(orders ?? []).map((order) => ({
                      value: order.id,
                      label: order.label ? `${order.number} · ${order.label}` : order.number,
                    }))}
                  />
                  <FormTextField
                    name="sale_number"
                    label="…or sale number"
                    placeholder="FC-2026-0012"
                  />
                </div>
                <FormTextareaField name="address_snapshot" label="Address" rows={2} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormTextField name="phone_snapshot" label="Phone" type="tel" />
                  <FormNumberField name="fee" label="Delivery fee" min={0} suffix={currency} />
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="promised-at">Promised for</Label>
                    <Input
                      id="promised-at"
                      type="datetime-local"
                      value={values.promised_at}
                      onChange={(event) => void setFieldValue("promised_at", event.target.value)}
                    />
                  </div>
                </div>
                <FormTextareaField name="delivery_notes" label="Notes for the rider" rows={2} />
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                    Add delivery
                  </Button>
                </DialogFooter>
              </Form>
            )}
          </Formik>
        </DialogContent>
      </Dialog>
    </>
  );
}
