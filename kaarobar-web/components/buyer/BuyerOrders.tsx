"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, ShoppingBag } from "lucide-react";
import { api } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import {
  Alert,
  StatusBadge,
  TabBar,
} from "@/components/app/ui";
import {
  BuyerCard,
  BuyerEmptyPanel,
  BuyerHero,
} from "@/components/buyer/BuyerLayout";
import { BuyerOrderListSkeleton } from "@/components/buyer/BuyerSkeletons";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { detailRoutes } from "@/lib/navigation";

type Order = {
  id: string;
  invoice_number: string;
  total_amount: string;
  inserted_at?: string;
  status: string;
  source?: string;
  business_name?: string | null;
};

type Appointment = {
  id: string;
  business_id: string;
  business_name?: string | null;
  product_name?: string | null;
  staff_name?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  status: string;
  duration_minutes?: number | null;
};

type Tab = "orders" | "appointments";

function statusTone(status: string): "success" | "warning" | "danger" | "info" {
  const s = status.toLowerCase();
  if (s === "completed" || s === "ready") return "success";
  if (s === "cancelled" || s === "noshow") return "danger";
  if (s === "placed" || s === "confirmed" || s === "booked" || s === "checkedin")
    return "warning";
  return "info";
}

function isUpcoming(a: Appointment): boolean {
  const s = a.status.toLowerCase();
  if (["cancelled", "completed", "noshow"].includes(s)) return false;
  if (!a.starts_at) return true;
  return new Date(a.starts_at).getTime() >= Date.now() - 60 * 60 * 1000;
}

/** Buyer view of `/app/sales` — orders + upcoming appointments. */
export default function BuyerOrders() {
  const t = useT();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    void Promise.all([
      api<{ data: Order[] }>("/portal/orders"),
      api<{ data: Appointment[] }>("/portal/appointments").catch(() => ({
        data: [] as Appointment[],
      })),
    ])
      .then(([orderRes, apptRes]) => {
        setOrders(orderRes.data || []);
        setAppointments(apptRes.data || []);
        setError(null);
        const upcoming = (apptRes.data || []).filter(isUpcoming);
        if (upcoming.length > 0 && (orderRes.data || []).length === 0) {
          setTab("appointments");
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const upcoming = useMemo(
    () =>
      appointments
        .filter(isUpcoming)
        .sort((a, b) => (a.starts_at || "").localeCompare(b.starts_at || "")),
    [appointments]
  );

  const past = useMemo(
    () =>
      appointments
        .filter((a) => !isUpcoming(a))
        .sort((a, b) => (b.starts_at || "").localeCompare(a.starts_at || "")),
    [appointments]
  );

  async function cancelAppointment(id: string) {
    setCancellingId(id);
    try {
      await api(`/portal/appointments/${id}/cancel`, { method: "POST", body: "{}" });
      toast.success(t("appointments.cancelled"));
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("appointments.cancelFailed"));
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <BuyerHero
        eyebrow={t("marketplace.eyebrow")}
        title={t("pages.buyerOrdersTitle")}
        description={t("pages.buyerOrdersDesc")}
        infoKey="page.buyer.orders"
      />

      <TabBar
        aria-label={t("appointments.ordersTabs")}
        tabs={[
          {
            id: "orders" as const,
            label: t("appointments.tabOrders"),
            badge: orders.length || undefined,
            infoKey: "tab.buyer.orders",
          },
          {
            id: "appointments" as const,
            label: t("appointments.tabAppointments"),
            badge: upcoming.length || undefined,
            infoKey: "tab.buyer.appointments",
          },
        ]}
        value={tab}
        onChange={setTab}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <BuyerOrderListSkeleton />
      ) : tab === "orders" ? (
        orders.length === 0 ? (
          <BuyerEmptyPanel
            icon={<ShoppingBag className="h-7 w-7" />}
            title={t("marketplace.emptyOrdersTitle")}
            body={t("marketplace.emptyOrdersBody")}
            action={
              <Link
                href="/app"
                className="inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover"
              >
                {t("marketplace.browseStores")}
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={detailRoutes.sale(o.id)} className="group block">
                  <BuyerCard
                    hover
                    className="flex items-center gap-4 p-4"
                  >
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-brand-soft text-sm font-bold text-brand">
                      {(o.business_name || "O").slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-heading">{o.invoice_number}</p>
                        <StatusBadge tone={statusTone(o.status)}>{o.status}</StatusBadge>
                        {o.source === "online" ? (
                          <StatusBadge tone="info">{t("marketplace.onlineBadge")}</StatusBadge>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-sm text-body">
                        {o.business_name ? `${o.business_name} · ` : ""}
                        {o.inserted_at ? new Date(o.inserted_at).toLocaleString() : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-lg font-bold text-heading">
                      Rs {o.total_amount}
                    </p>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted transition group-hover:text-brand" />
                  </BuyerCard>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : upcoming.length === 0 && past.length === 0 ? (
        <BuyerEmptyPanel
          icon={<Calendar className="h-7 w-7" />}
          title={t("appointments.emptyTitle")}
          body={t("appointments.emptyBody")}
          action={
            <Link
              href="/app"
              className="inline-flex rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover"
            >
              {t("marketplace.browseStores")}
            </Link>
          }
        />
      ) : (
        <div className="space-y-6">
          {upcoming.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
                {t("appointments.upcoming")}
              </h2>
              <ul className="space-y-3">
                {upcoming.map((a) => (
                  <li key={a.id}>
                    <BuyerCard className="flex flex-wrap items-center gap-4 p-4">
                      <Link
                        href={detailRoutes.appointment(a.id)}
                        className="flex min-w-0 flex-1 items-center gap-4"
                      >
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-brand-soft text-sm font-bold text-brand">
                          {(a.business_name || "A").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-heading">
                              {a.product_name || t("appointments.service")}
                            </p>
                            <StatusBadge tone={statusTone(a.status)}>{a.status}</StatusBadge>
                          </div>
                          <p className="mt-1 text-sm text-body">
                            {a.business_name ? `${a.business_name} · ` : ""}
                            {a.starts_at ? new Date(a.starts_at).toLocaleString() : ""}
                            {a.staff_name ? ` · ${a.staff_name}` : ""}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
                      </Link>
                      {a.status === "Booked" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          loading={cancellingId === a.id}
                          onClick={() => void cancelAppointment(a.id)}
                          className="rounded-md"
                        >
                          {t("appointments.cancel")}
                        </Button>
                      ) : null}
                    </BuyerCard>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {past.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
                {t("appointments.past")}
              </h2>
              <ul className="space-y-3">
                {past.map((a) => (
                  <li key={a.id}>
                    <Link href={detailRoutes.appointment(a.id)} className="block">
                      <BuyerCard hover className="flex items-center gap-4 p-4 opacity-90">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold text-heading">
                              {a.product_name || t("appointments.service")}
                            </p>
                            <StatusBadge tone={statusTone(a.status)}>{a.status}</StatusBadge>
                          </div>
                          <p className="mt-1 text-sm text-muted">
                            {a.business_name ? `${a.business_name} · ` : ""}
                            {a.starts_at ? new Date(a.starts_at).toLocaleString() : ""}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
                      </BuyerCard>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
