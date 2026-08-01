"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Search, X } from "lucide-react";
import { api, isConsumerSession } from "@/lib/api/client";
import { fieldClass, PageHeader, SurfaceCard } from "@/components/app/ui";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";
import { notifyNotificationsChanged } from "@/lib/hooks/useUnreadNotifications";
import {
  BuyerBackLink,
  BuyerCard,
  BuyerEmptyPanel,
  BuyerHero,
} from "@/components/buyer/BuyerLayout";

type Note = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  status: string;
  read_at?: string | null;
  inserted_at: string;
};

function notifBase() {
  return isConsumerSession() ? "/portal/notifications" : "/notifications";
}

export default function NotificationsPage() {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const buyer = isConsumerSession();

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Note[]; meta?: { unread?: number } }>(notifBase());
      setItems(res.data || []);
      setUnread(res.meta?.unread ?? (res.data || []).filter((n) => !n.read_at).length);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("notifications.loadFailed"));
    }
  }, [t, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((n) =>
      `${n.title ?? ""} ${n.type} ${n.body ?? ""} ${n.status}`
        .toLowerCase()
        .includes(q)
    );
  }, [items, query]);

  async function markRead(id: string) {
    try {
      await api(`${notifBase()}/${id}/read`, { method: "POST" });
      await load();
      notifyNotificationsChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    }
  }

  async function markAllRead() {
    setBusy(true);
    try {
      await api(`${notifBase()}/read-all`, { method: "POST" });
      await load();
      notifyNotificationsChanged();
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  if (buyer) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <BuyerBackLink href="/app/account">{t("nav.account")}</BuyerBackLink>
        <BuyerHero
          eyebrow={t("marketplace.eyebrow")}
          title={t("pages.notificationsTitle")}
          description={t("pages.buyerNotificationsDesc")}
          infoKey="page.buyer.notifications"
          action={
            unread > 0
              ? {
                  label: busy ? t("common.loading") : t("notifications.markAllRead"),
                  onClick: () => void markAllRead(),
                }
              : undefined
          }
        />

        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            className={`${fieldClass} pl-9 pr-9`}
            placeholder={t("common.search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-heading"
              onClick={() => setQuery("")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        {filtered.length === 0 ? (
          <BuyerEmptyPanel
            icon={<Bell className="h-7 w-7" />}
            title={t("notifications.empty")}
            body={t("pages.buyerNotificationsDesc")}
          />
        ) : (
          <div className="space-y-3">
            {filtered.map((n) => (
              <BuyerCard key={n.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-heading">{n.title || n.type}</p>
                    {n.body ? <p className="mt-1 text-sm text-body">{n.body}</p> : null}
                    <p className="mt-2 text-xs text-muted">
                      {new Date(n.inserted_at).toLocaleString()}
                      {n.read_at
                        ? ` · ${t("notifications.read")}`
                        : ` · ${t("notifications.unread")}`}
                    </p>
                  </div>
                  {!n.read_at ? (
                    <Button size="sm" variant="secondary" onClick={() => void markRead(n.id)}>
                      {t("notifications.markRead")}
                    </Button>
                  ) : null}
                </div>
              </BuyerCard>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("pages.notificationsTitle")}
        description={t("pages.notificationsDesc")}
        infoKey="page.notifications"
        action={
          unread > 0
            ? {
                label: busy ? t("common.loading") : t("notifications.markAllRead"),
                onClick: () => void markAllRead(),
              }
            : undefined
        }
      />

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          className={`${fieldClass} pl-9 pr-9`}
          placeholder={t("common.search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query ? (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-heading"
            onClick={() => setQuery("")}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <SurfaceCard className="p-8 text-center">
          <p className="text-sm text-body">{t("notifications.empty")}</p>
        </SurfaceCard>
      ) : (
        <div className="space-y-3">
          {filtered.map((n) => (
            <SurfaceCard key={n.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-heading">{n.title || n.type}</p>
                  {n.body ? <p className="mt-1 text-sm text-body">{n.body}</p> : null}
                  <p className="mt-2 text-xs text-muted">
                    {new Date(n.inserted_at).toLocaleString()}
                    {n.read_at
                      ? ` · ${t("notifications.read")}`
                      : ` · ${t("notifications.unread")}`}
                  </p>
                </div>
                {!n.read_at ? (
                  <Button size="sm" variant="secondary" onClick={() => void markRead(n.id)}>
                    {t("notifications.markRead")}
                  </Button>
                ) : null}
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </div>
  );
}
