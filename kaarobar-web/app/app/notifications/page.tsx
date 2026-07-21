"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { PageHeader, SurfaceCard, fieldClass } from "@/components/app/ui";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/lib/i18n";

type Note = {
  id: string;
  type: string;
  title?: string;
  body?: string;
  status: string;
  read_at?: string | null;
  inserted_at: string;
};

export default function NotificationsPage() {
  const t = useT();
  const toast = useToast();
  const [items, setItems] = useState<Note[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Note[] }>("/notifications");
      setItems(res.data || []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("notifications.loadFailed"));
    }
  }, [t, toast]);

  useEffect(() => {
    load();
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
    await api(`/notifications/${id}/read`, { method: "POST", body: "{}" });
    await load();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("notifications.eyebrow")}
        title={t("pages.notificationsTitle")}
        description={t("pages.notificationsDesc")}
      />

      <label className="relative block max-w-md">
        <span className="sr-only">{t("common.search")}</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("notifications.searchPlaceholder")}
          className={`${fieldClass} pl-9 pr-9`}
        />
        {query ? (
          <button
            type="button"
            aria-label={t("common.close")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted hover:bg-bg-hover"
            onClick={() => setQuery("")}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </label>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <SurfaceCard>
            <p className="px-6 py-10 text-center text-sm text-body">
              {query.trim() ? t("notifications.noMatching") : t("notifications.empty")}
            </p>
          </SurfaceCard>
        ) : (
          filtered.map((n) => (
            <SurfaceCard
              key={n.id}
              className="flex flex-wrap items-start justify-between gap-3 p-4"
            >
              <div>
                <p className="font-semibold text-heading">{n.title || n.type}</p>
                <p className="text-sm text-body">{n.body || n.status}</p>
                <p className="mt-1 text-xs text-muted">
                  {new Date(n.inserted_at).toLocaleString()}
                  {n.read_at ? ` · ${t("common.read")}` : ""}
                </p>
              </div>
              {!n.read_at ? (
                <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>
                  {t("common.markRead")}
                </Button>
              ) : null}
            </SurfaceCard>
          ))
        )}
      </div>
    </div>
  );
}
