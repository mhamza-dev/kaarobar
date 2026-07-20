"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api/client";
import { Alert, PageHeader, SurfaceCard, fieldClass } from "@/components/app/ui";
import Button from "@/components/ui/Button";

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
  const [items, setItems] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: Note[] }>("/notifications");
      setItems(res.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    }
  }, []);

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
        eyebrow="Inbox"
        title="Notifications"
        description="Leave, payroll, and billing alerts."
      />
      {error ? <Alert tone="error">{error}</Alert> : null}

      <label className="relative block max-w-md">
        <span className="sr-only">Search</span>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notifications…"
          className={`${fieldClass} pl-9 pr-9`}
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
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
              {query.trim() ? "No matching notifications." : "No notifications yet."}
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
                  {n.read_at ? " · read" : ""}
                </p>
              </div>
              {!n.read_at ? (
                <Button size="sm" variant="outline" onClick={() => markRead(n.id)}>
                  Mark read
                </Button>
              ) : null}
            </SurfaceCard>
          ))
        )}
      </div>
    </div>
  );
}
