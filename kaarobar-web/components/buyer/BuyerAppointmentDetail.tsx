"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { api } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { Alert, StatusBadge } from "@/components/app/ui";
import InfoButton from "@/components/ui/InfoButton";
import {
  BuyerBackLink,
  BuyerCard,
  BuyerEmptyPanel,
} from "@/components/buyer/BuyerLayout";
import { BuyerOrderDetailSkeleton } from "@/components/buyer/BuyerSkeletons";
import { useT } from "@/lib/i18n";

type Appointment = {
  id: string;
  business_id: string;
  business_name?: string | null;
  product_name?: string | null;
  product_id?: string | null;
  staff_name?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status: string;
  notes?: string | null;
  duration_minutes?: number | null;
};

function statusTone(status: string): "success" | "warning" | "danger" | "info" {
  const s = status.toLowerCase();
  if (s === "completed") return "success";
  if (s === "cancelled" || s === "noshow") return "danger";
  if (s === "booked" || s === "confirmed" || s === "checkedin") return "warning";
  return "info";
}

function canCancel(status: string) {
  return status === "Booked";
}

/** Buyer appointment detail — `/app/sales/appointments/[id]`. */
export default function BuyerAppointmentDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const t = useT();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    // Portal has list + cancel; resolve detail from the list until a show route ships.
    void api<{ data: Appointment[] }>("/portal/appointments")
      .then((res) => {
        const found = (res.data || []).find((a) => a.id === id) || null;
        setAppt(found);
        setError(found ? null : t("appointments.detailNotFound"));
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : t("appointments.loadFailed"))
      )
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function cancelAppointment() {
    if (!appt) return;
    setCancelling(true);
    try {
      const res = await api<{ data: Appointment }>(
        `/portal/appointments/${appt.id}/cancel`,
        { method: "POST", body: "{}" }
      );
      setAppt(res.data);
      toast.success(t("appointments.cancelled"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("appointments.cancelFailed"));
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <BuyerOrderDetailSkeleton />;

  if (error && !appt) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <BuyerBackLink href="/app/sales">{t("marketplace.backToOrders")}</BuyerBackLink>
        <BuyerEmptyPanel
          icon={<Calendar className="h-7 w-7" />}
          title={t("appointments.detailNotFound")}
          body={t("appointments.detailNotFoundBody")}
          action={
            <Link href="/app/sales">
              <Button variant="secondary" className="rounded-md">
                {t("marketplace.backToOrders")}
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (!appt) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <BuyerBackLink href="/app/sales">{t("marketplace.backToOrders")}</BuyerBackLink>

      <BuyerCard className="p-0">
        <div className="border-b border-border bg-gradient-to-br from-brand-soft/80 to-transparent px-5 py-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-md bg-brand text-brand-foreground shadow-brand">
                <Calendar className="h-6 w-6" strokeWidth={2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">
                    {t("appointments.tabAppointments")}
                  </p>
                  <InfoButton topicId="page.buyer.appointmentDetail" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-heading sm:text-2xl">
                  {appt.product_name || t("appointments.service")}
                </h1>
                <p className="mt-1 text-sm text-body">
                  {appt.business_name || t("marketplace.store")}
                </p>
              </div>
            </div>
            <StatusBadge tone={statusTone(appt.status)}>{appt.status}</StatusBadge>
          </div>
        </div>

        <dl className="space-y-3 px-5 py-5 text-sm sm:px-6">
          <div className="flex justify-between gap-4 border-b border-border pb-3">
            <dt className="text-body">{t("appointments.time")}</dt>
            <dd className="text-end font-semibold text-heading">
              {appt.starts_at ? new Date(appt.starts_at).toLocaleString() : "—"}
              {appt.ends_at
                ? ` – ${new Date(appt.ends_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                : ""}
            </dd>
          </div>
          {appt.duration_minutes ? (
            <div className="flex justify-between gap-4 border-b border-border pb-3">
              <dt className="text-body">{t("appointments.duration")}</dt>
              <dd className="font-semibold text-heading">
                {t("appointments.minutes", { count: appt.duration_minutes })}
              </dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4 border-b border-border pb-3">
            <dt className="text-body">{t("appointments.staff")}</dt>
            <dd className="font-semibold text-heading">
              {appt.staff_name || t("appointments.anyStaff")}
            </dd>
          </div>
          {appt.notes ? (
            <div className="flex justify-between gap-4">
              <dt className="text-body">{t("marketplace.notes")}</dt>
              <dd className="max-w-[60%] text-end text-heading">{appt.notes}</dd>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-wrap gap-3 border-t border-border px-5 py-4 sm:px-6">
          {appt.business_id ? (
            <Link href={`/app/market/${appt.business_id}`}>
              <Button variant="secondary" className="rounded-md">
                {t("marketplace.visitStore")}
              </Button>
            </Link>
          ) : null}
          {canCancel(appt.status) ? (
            <Button
              variant="outline"
              className="rounded-md"
              loading={cancelling}
              onClick={() => void cancelAppointment()}
            >
              {t("appointments.cancel")}
            </Button>
          ) : null}
          <Button
            variant="ghost"
            className="rounded-md ms-auto"
            onClick={() => router.push("/app/sales")}
          >
            {t("marketplace.backToOrders")}
          </Button>
        </div>
      </BuyerCard>

      {error ? <Alert tone="error">{error}</Alert> : null}
    </div>
  );
}
