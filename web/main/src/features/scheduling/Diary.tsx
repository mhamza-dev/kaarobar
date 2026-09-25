"use client";

import { addDays, format, parseISO } from "date-fns";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useAdvanceAppointment,
  useAppointments,
  useCancelAppointment,
  useMarkNoShow,
  useResources,
} from "@/hooks/queries/useScheduling";
import { usePermission } from "@/hooks/usePermission";
import { useSheetParam } from "@/hooks/useSheetParam";
import { toast } from "@/hooks/useToast";
import { canMarkNoShow, isLiveAppointment, nextAppointmentStep } from "@/lib/appointments";
import { formatMoney } from "@/lib/format";
import { useSessionStore } from "@/stores/sessionStore";
import type { Appointment } from "@/types/api/scheduling";

import { AppointmentSheet } from "./AppointmentSheet";
import { BookAppointmentDialog } from "./BookAppointmentDialog";

function timeOf(value: string): string {
  return format(parseISO(value), "HH:mm");
}

/**
 * The day's book: one column per bookable resource, each visit placed in
 * the column of whoever is doing it, in time order.
 *
 * A list per column rather than a pixel time-grid — a salon at the counter
 * reads "who's next for Ayesha", and a list answers that without making the
 * receptionist scroll a grid of empty half-hours.
 */
export function Diary() {
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [booking, setBooking] = useState(false);
  const sheet = useSheetParam();

  // The shop's day, not UTC's: local midnight to local midnight, sent as
  // instants so the backend compares like with like.
  const from = parseISO(date).toISOString();
  const to = addDays(parseISO(date), 1).toISOString();
  const { data: resources, isLoading: loadingResources } = useResources();
  const { data: appointments, isLoading } = useAppointments({ from, to });

  const bookable = (resources ?? []).filter((resource) => resource.is_active);

  const shift = (days: number) => setDate(format(addDays(parseISO(date), days), "yyyy-MM-dd"));

  if (!loadingResources && bookable.length === 0) {
    return (
      <EmptyState
        icon={CalendarPlus}
        title="No one to book yet"
        description="Add your staff, chairs or rooms as resources before taking bookings."
        action={
          can("resource:manage") && (
            <Button nativeButton={false} render={<Link href="/appointments/resources" />}>
              Add resources
            </Button>
          )
        }
      />
    );
  }

  // Place each visit under the resource doing its first service.
  const byResource = new Map<string, Appointment[]>();
  const unassigned: Appointment[] = [];
  for (const appointment of appointments ?? []) {
    const resourceId = appointment.services?.[0]?.resource_id;
    if (resourceId)
      byResource.set(resourceId, [...(byResource.get(resourceId) ?? []), appointment]);
    else unassigned.push(appointment);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" aria-label="Previous day" onClick={() => shift(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <Input
            type="date"
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            className="w-44"
            aria-label="Diary date"
          />
          <Button variant="outline" size="icon" aria-label="Next day" onClick={() => shift(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" onClick={() => setDate(format(new Date(), "yyyy-MM-dd"))}>
            Today
          </Button>
        </div>
        {can("appointment:manage") && (
          <Button onClick={() => setBooking(true)}>
            <CalendarPlus className="size-4" />
            Book
          </Button>
        )}
      </div>

      {isLoading || loadingResources ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {bookable.map((resource) => (
            <section
              key={resource.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3"
            >
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className="size-2.5 rounded-full bg-brand-primary"
                  style={resource.colour ? { backgroundColor: resource.colour } : undefined}
                />
                {resource.name}
              </h2>
              {(byResource.get(resource.id) ?? []).length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Free all day</p>
              ) : (
                (byResource.get(resource.id) ?? []).map((appointment) => (
                  <AppointmentCard
                    key={appointment.id}
                    appointment={appointment}
                    currency={currency}
                    onOpen={() => sheet.open(appointment.id)}
                  />
                ))
              )}
            </section>
          ))}
          {unassigned.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-3">
              <h2 className="text-sm font-semibold">Anyone free</h2>
              {unassigned.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  currency={currency}
                  onOpen={() => sheet.open(appointment.id)}
                />
              ))}
            </section>
          )}
        </div>
      )}

      <BookAppointmentDialog open={booking} onOpenChange={setBooking} date={date} />
      <AppointmentSheet appointmentId={sheet.value} onClose={sheet.close} />
    </div>
  );
}

function AppointmentCard({
  appointment,
  currency,
  onOpen,
}: {
  appointment: Appointment;
  currency: string;
  onOpen: () => void;
}) {
  const { can } = usePermission();
  const advance = useAdvanceAppointment();
  const cancel = useCancelAppointment();
  const noShow = useMarkNoShow();
  const next = nextAppointmentStep(appointment.status);
  const live = isLiveAppointment(appointment.status);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      toast.success(message);
    } catch {
      // Toasted by the hook.
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Open booking for ${appointment.who ?? "walk-in"} at ${timeOf(appointment.starts_at)}`}
        >
          <p className="font-medium tabular-nums">
            {timeOf(appointment.starts_at)}–{timeOf(appointment.ends_at)}
          </p>
          <p>{appointment.who ?? "Walk-in"}</p>
          <p className="text-xs text-muted-foreground">
            {(appointment.services ?? [])
              .map((service) =>
                service.price
                  ? `${service.name} (${formatMoney(service.price, currency)})`
                  : service.name,
              )
              .join(", ")}
          </p>
        </button>
        <StatusBadge status={appointment.status} />
      </div>
      {live && (
        <div className="flex flex-wrap gap-1">
          {next && can("appointment:manage") && (
            <Button
              size="xs"
              disabled={advance.isPending}
              onClick={() =>
                run(() => advance.mutateAsync([appointment.id, next.step]), "Booking updated")
              }
            >
              {next.label}
            </Button>
          )}
          {canMarkNoShow(appointment.status) && can("appointment:cancel") && (
            <Button
              size="xs"
              variant="ghost"
              disabled={noShow.isPending}
              onClick={() => run(() => noShow.mutateAsync([appointment.id]), "Marked no-show")}
            >
              No-show
            </Button>
          )}
          {appointment.status !== "in_progress" && can("appointment:cancel") && (
            <Button
              size="xs"
              variant="ghost"
              disabled={cancel.isPending}
              onClick={() => run(() => cancel.mutateAsync([appointment.id]), "Booking cancelled")}
            >
              Cancel
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
