"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Check, ChevronLeft, Clock, User } from "lucide-react";
import { api, isConsumerSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import { Alert, EmptyState } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";

export type BookableService = {
  id: string;
  name: string;
  price?: string | null;
  description?: string | null;
  duration_minutes?: number | null;
  image_url?: string | null;
  category?: string | null;
  category_ref?: { id: string; name: string } | null;
  product_kind?: string | null;
};

export type BookableStaff = {
  id: string;
  name: string;
};

type Slot = {
  starts_at: string;
  ends_at: string;
  staff_id: string;
  product_id: string;
  branch_id: string;
  duration_minutes: number;
};

type Step = "service" | "staff" | "slot" | "confirm";

function formatPrice(price?: string | number | null): string {
  const n = Number(price || 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function formatSlotTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function todayIso(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Props = {
  businessId: string;
  branchId?: string | null;
  services: BookableService[];
  staff: BookableStaff[];
  accent?: string;
};

/** Customer appointment booking: service → optional staff → slot → confirm (CUS-FR-005 / SCH-FR-001). */
export default function BuyerBookFlow({
  businessId,
  branchId,
  services,
  staff,
  accent,
}: Props) {
  const t = useT();
  const toast = useToast();
  const router = useRouter();
  const signedIn = isConsumerSession();

  const [step, setStep] = useState<Step>("service");
  const [service, setService] = useState<BookableService | null>(null);
  const [staffMember, setStaffMember] = useState<BookableStaff | null>(null);
  /** null = any available staff */
  const [anyStaff, setAnyStaff] = useState(true);
  const [date, setDate] = useState(addDaysIso(1));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [notes, setNotes] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateOptions = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const iso = addDaysIso(i === 0 ? 0 : i);
        const label = new Date(iso + "T12:00:00").toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
        return { iso, label, disabled: iso < todayIso() };
      }),
    []
  );

  const loadSlots = useCallback(async () => {
    if (!service || !signedIn) return;
    const staffIds = anyStaff
      ? staff.map((s) => s.id)
      : staffMember
        ? [staffMember.id]
        : [];
    if (staffIds.length === 0) {
      setSlots([]);
      setError(t("appointments.noStaff"));
      return;
    }

    setLoadingSlots(true);
    setError(null);
    setSlot(null);
    try {
      const results = await Promise.all(
        staffIds.map((sid) =>
          api<{ data: Slot[] }>(
            `/portal/appointments/slots?business_id=${encodeURIComponent(businessId)}&product_id=${encodeURIComponent(service.id)}&staff_id=${encodeURIComponent(sid)}&date=${encodeURIComponent(date)}${branchId ? `&branch_id=${encodeURIComponent(branchId)}` : ""}`
          ).then((res) => res.data || [])
        )
      );
      const merged = results
        .flat()
        .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
      setSlots(merged);
      if (merged.length === 0) setError(t("appointments.noSlots"));
    } catch (err) {
      setSlots([]);
      setError(err instanceof Error ? err.message : t("appointments.slotsFailed"));
    } finally {
      setLoadingSlots(false);
    }
  }, [
    anyStaff,
    branchId,
    businessId,
    date,
    service,
    signedIn,
    staff,
    staffMember,
    t,
  ]);

  useEffect(() => {
    if (step === "slot") void loadSlots();
  }, [step, loadSlots]);

  function requireSignIn(): boolean {
    if (!signedIn) {
      router.push("/login?as=consumer");
      return false;
    }
    return true;
  }

  function pickService(s: BookableService) {
    if (!requireSignIn()) return;
    setService(s);
    setStep("staff");
  }

  function continueFromStaff() {
    if (!anyStaff && !staffMember) {
      toast.error(t("appointments.pickStaff"));
      return;
    }
    setStep("slot");
  }

  function pickSlot(s: Slot) {
    setSlot(s);
    setStep("confirm");
  }

  async function confirmBooking() {
    if (!service || !slot) return;
    setBooking(true);
    setError(null);
    try {
      await api("/portal/appointments", {
        method: "POST",
        body: JSON.stringify({
          business_id: businessId,
          branch_id: branchId || slot.branch_id,
          product_id: service.id,
          staff_id: slot.staff_id,
          starts_at: slot.starts_at,
          ends_at: slot.ends_at,
          notes: notes.trim() || undefined,
        }),
      });
      toast.success(t("appointments.booked"));
      router.push("/app/sales");
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("appointments.bookFailed");
      setError(msg);
      toast.error(msg);
    } finally {
      setBooking(false);
    }
  }

  const staffNameForSlot = (sid: string) =>
    staff.find((s) => s.id === sid)?.name || t("appointments.staff");

  if (services.length === 0) {
    return (
      <EmptyState
        title={t("appointments.emptyServicesTitle")}
        body={t("appointments.emptyServicesBody")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
        {(
          [
            ["service", t("appointments.stepService")],
            ["staff", t("appointments.stepStaff")],
            ["slot", t("appointments.stepSlot")],
            ["confirm", t("appointments.stepConfirm")],
          ] as const
        ).map(([id, label], i) => {
          const order: Step[] = ["service", "staff", "slot", "confirm"];
          const active = step === id;
          const done = order.indexOf(step) > i;
          return (
            <span
              key={id}
              className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 ${
                active
                  ? "bg-brand text-brand-foreground"
                  : done
                    ? "bg-brand-soft text-brand"
                    : "bg-bg-secondary text-muted"
              }`}
            >
              {done ? <Check className="h-3 w-3" /> : null}
              {label}
            </span>
          );
        })}
      </div>

      {error && step !== "slot" ? <Alert tone="error">{error}</Alert> : null}

      {step === "service" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => pickService(s)}
              className="flex flex-col rounded-md border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-md"
              style={accent ? { borderTopWidth: 3, borderTopColor: accent } : undefined}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                {s.category_ref?.name || s.category || t("appointments.service")}
              </p>
              <p className="mt-1 font-semibold text-heading">{s.name}</p>
              {s.duration_minutes ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  {t("appointments.minutes", { count: s.duration_minutes })}
                </p>
              ) : null}
              <p className="mt-auto pt-3 text-lg font-bold text-heading">
                Rs {formatPrice(s.price)}
              </p>
            </button>
          ))}
        </div>
      ) : null}

      {step === "staff" && service ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep("service")}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            {service.name}
          </button>
          <p className="text-sm text-body">{t("appointments.staffHint")}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => {
                setAnyStaff(true);
                setStaffMember(null);
              }}
              className={`flex items-center gap-3 rounded-md border p-4 text-left transition ${
                anyStaff
                  ? "border-brand bg-brand-soft shadow-sm"
                  : "border-border bg-card hover:border-brand/30"
              }`}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-brand/15 text-brand">
                <User className="h-5 w-5" />
              </span>
              <span>
                <p className="font-semibold text-heading">{t("appointments.anyStaff")}</p>
                <p className="text-xs text-muted">{t("appointments.anyStaffHint")}</p>
              </span>
            </button>
            {staff.map((s) => {
              const on = !anyStaff && staffMember?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setAnyStaff(false);
                    setStaffMember(s);
                  }}
                  className={`flex items-center gap-3 rounded-md border p-4 text-left transition ${
                    on
                      ? "border-brand bg-brand-soft shadow-sm"
                      : "border-border bg-card hover:border-brand/30"
                  }`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-bg-secondary font-bold text-heading">
                    {s.name.slice(0, 1).toUpperCase()}
                  </span>
                  <p className="font-semibold text-heading">{s.name}</p>
                </button>
              );
            })}
          </div>
          <Button onClick={continueFromStaff} className="rounded-md">
            {t("appointments.continueToSlots")}
          </Button>
        </div>
      ) : null}

      {step === "slot" && service ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep("staff")}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("appointments.stepStaff")}
          </button>
          <div className="flex flex-wrap gap-2">
            {dateOptions.map((d) => (
              <button
                key={d.iso}
                type="button"
                disabled={d.disabled}
                onClick={() => setDate(d.iso)}
                className={`rounded-md px-3 py-2 text-xs font-semibold transition ${
                  date === d.iso
                    ? "bg-brand text-brand-foreground"
                    : "border border-border bg-card text-heading hover:border-brand/30 disabled:opacity-40"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          {loadingSlots ? (
            <p className="text-sm text-muted">{t("appointments.loadingSlots")}</p>
          ) : error ? (
            <Alert tone="warning">{error}</Alert>
          ) : (
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {slots.map((s) => (
                <button
                  key={`${s.staff_id}-${s.starts_at}`}
                  type="button"
                  onClick={() => pickSlot(s)}
                  className="rounded-md border border-border bg-card px-3 py-3 text-left transition hover:border-brand/40 hover:shadow-sm"
                >
                  <p className="font-semibold text-heading">{formatSlotTime(s.starts_at)}</p>
                  {anyStaff ? (
                    <p className="mt-1 text-xs text-muted">{staffNameForSlot(s.staff_id)}</p>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {step === "confirm" && service && slot ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setStep("slot")}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            {t("appointments.stepSlot")}
          </button>
          <div className="rounded-md border border-border bg-card p-5 space-y-3">
            <p className="text-lg font-bold text-heading">{service.name}</p>
            <p className="flex items-center gap-2 text-sm text-body">
              <Calendar className="h-4 w-4 text-muted" />
              {new Date(slot.starts_at).toLocaleString()}
            </p>
            <p className="flex items-center gap-2 text-sm text-body">
              <User className="h-4 w-4 text-muted" />
              {staffNameForSlot(slot.staff_id)}
            </p>
            <p className="flex items-center gap-2 text-sm text-body">
              <Clock className="h-4 w-4 text-muted" />
              {t("appointments.minutes", {
                count: slot.duration_minutes || service.duration_minutes || 30,
              })}
              {" · "}
              Rs {formatPrice(service.price)}
            </p>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-heading">
                {t("appointments.notes")}
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-bg-primary px-3 py-2 text-sm text-heading outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/15"
                placeholder={t("appointments.notesPlaceholder")}
              />
            </label>
          </div>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Button loading={booking} onClick={() => void confirmBooking()} className="rounded-md">
            {t("appointments.confirmBook")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
