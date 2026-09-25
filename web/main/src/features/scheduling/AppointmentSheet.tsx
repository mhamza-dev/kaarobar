"use client";

import { format, parseISO } from "date-fns";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DescriptionList } from "@/components/shared/DescriptionList";
import { DetailSheet } from "@/components/shared/DetailSheet";
import { ReasonDialog } from "@/components/shared/ReasonDialog";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  WorkflowActions,
  type WorkflowAction,
} from "@/components/shared/WorkflowActions/WorkflowActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAdvanceAppointment,
  useAppointment,
  useCancelAppointment,
  useMarkNoShow,
  useRescheduleAppointment,
} from "@/hooks/queries/useScheduling";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { canMarkNoShow, isLiveAppointment, nextAppointmentStep } from "@/lib/appointments";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";

const timeOf = (iso: string) => format(parseISO(iso), "HH:mm");

/**
 * One booking: who, which services with whom, and everything that can
 * happen to it — the next step, moving it, cancelling with a reason, or
 * marking a no-show.
 */
export function AppointmentSheet({
  appointmentId,
  onClose,
}: {
  appointmentId: string | null;
  onClose: () => void;
}) {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const {
    data: appointment,
    isLoading,
    error,
    refetch,
  } = useAppointment(appointmentId ?? undefined);
  const advance = useAdvanceAppointment();
  const reschedule = useRescheduleAppointment();
  const cancel = useCancelAppointment();
  const noShow = useMarkNoShow();
  const [cancelling, setCancelling] = useState(false);
  const [newStart, setNewStart] = useState("");

  const live = appointment ? isLiveAppointment(appointment.status) : false;
  const next = appointment ? nextAppointmentStep(appointment.status) : null;

  const actions: WorkflowAction[] = appointment
    ? [
        {
          key: "advance",
          label: next?.label ?? "Next",
          variant: "default",
          available: !!next,
          permitted: can("appointment:manage"),
          pending: advance.isPending,
          onAction: async () => {
            await advance.mutateAsync([appointment.id, next!.step]);
            toast.success("Booking updated");
          },
        },
        {
          key: "no-show",
          label: "No-show",
          available: canMarkNoShow(appointment.status),
          permitted: can("appointment:cancel"),
          pending: noShow.isPending,
          confirm: {
            title: "Mark as a no-show?",
            description: "The slot is freed and the no-show is recorded against the customer.",
            confirmLabel: "Mark no-show",
          },
          onAction: async () => {
            await noShow.mutateAsync([appointment.id]);
            toast.success("Marked no-show");
          },
        },
        {
          key: "cancel",
          label: "Cancel booking",
          variant: "destructive",
          available: live && appointment.status !== "in_progress",
          permitted: can("appointment:cancel"),
          onAction: () => setCancelling(true),
        },
      ]
    : [];

  return (
    <>
      <DetailSheet
        open={!!appointmentId}
        onOpenChange={(open) => !open && onClose()}
        eyebrow={appointment ? `Booking ${appointment.number}` : "Booking"}
        title={appointment?.who ?? (appointment ? "Walk-in" : undefined)}
        description={
          appointment
            ? `${format(parseISO(appointment.starts_at), "EEE d MMM")}, ${timeOf(appointment.starts_at)}–${timeOf(appointment.ends_at)}`
            : undefined
        }
        status={appointment && <StatusBadge status={appointment.status} />}
        loading={isLoading}
        error={error}
        onRetry={() => refetch()}
        what="this booking"
        actions={<WorkflowActions actions={actions} />}
      >
        {appointment && (
          <div className="flex flex-col gap-4">
            <DescriptionList
              items={[
                {
                  label: "Customer",
                  value: appointment.customer_id ? (
                    <Link
                      href={`/customers/${appointment.customer_id}`}
                      className="text-brand-primary hover:underline"
                    >
                      {appointment.who}
                    </Link>
                  ) : (
                    (appointment.walk_in_name ?? "Walk-in")
                  ),
                },
                {
                  label: "Phone",
                  value: appointment.walk_in_phone,
                  hidden: !appointment.walk_in_phone,
                },
                { label: "Booked by", value: humanize(appointment.source ?? "staff") },
                { label: "Length", value: `${appointment.duration_minutes} min` },
                {
                  label: "Sale",
                  hidden: !appointment.sale_id,
                  value: (
                    <Link
                      href={`/sales/${appointment.sale_id}`}
                      className="text-brand-primary hover:underline"
                    >
                      View sale
                    </Link>
                  ),
                },
                {
                  label: "Why cancelled",
                  value: appointment.cancel_reason,
                  hidden: !appointment.cancel_reason,
                },
              ]}
            />

            <section>
              <h3 className="mb-2 text-sm font-semibold">Services</h3>
              <ul className="divide-y divide-border rounded-lg border border-border text-sm">
                {(appointment.services ?? []).map((service) => (
                  <li key={service.id} className="flex items-center justify-between gap-2 p-2">
                    <div>
                      <p className="font-medium">{service.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {timeOf(service.starts_at)}–{timeOf(service.ends_at)}
                        {service.resource && ` · ${service.resource.name}`}
                      </p>
                    </div>
                    {service.price && (
                      <span className="tabular-nums">{formatMoney(service.price, currency)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            {appointment.notes && (
              <p className="rounded-lg bg-muted/40 p-3 text-sm whitespace-pre-line">
                {appointment.notes}
              </p>
            )}

            {live && appointment.status !== "in_progress" && can("appointment:manage") && (
              <form
                className="flex flex-wrap items-end gap-2 border-t border-border pt-4"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (!newStart) return;
                  try {
                    await reschedule.mutateAsync([
                      appointment.id,
                      new Date(newStart).toISOString(),
                    ]);
                    toast.success(`Moved to ${formatDateTime(new Date(newStart).toISOString())}`);
                    setNewStart("");
                  } catch {
                    // Toasted by the hook — usually the new time clashes.
                  }
                }}
              >
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="reschedule-at">Move to</Label>
                  <Input
                    id="reschedule-at"
                    type="datetime-local"
                    value={newStart}
                    onChange={(event) => setNewStart(event.target.value)}
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!newStart || reschedule.isPending}
                >
                  {reschedule.isPending && <Loader2 className="size-4 animate-spin" />}
                  Reschedule
                </Button>
              </form>
            )}
          </div>
        )}
      </DetailSheet>

      {appointment && (
        <ReasonDialog
          open={cancelling}
          onOpenChange={setCancelling}
          title={`Cancel ${appointment.who ?? "this"} booking?`}
          description="The slot is freed. The reason stays on the booking."
          placeholder="Customer called to cancel…"
          confirmLabel="Cancel booking"
          destructive
          onSubmit={async (reason) => {
            await cancel.mutateAsync([appointment.id, reason]);
            toast.success("Booking cancelled");
            setCancelling(false);
          }}
        />
      )}
    </>
  );
}
