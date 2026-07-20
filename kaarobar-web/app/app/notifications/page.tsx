"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";

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

  async function markRead(id: string) {
    await api(`/notifications/${id}/read`, { method: "POST", body: "{}" });
    await load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-heading">Notifications</h1>
        <p className="text-body">Leave, payroll, and billing alerts.</p>
      </div>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-body">No notifications yet.</p>
        ) : (
          items.map((n) => (
            <div
              key={n.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div>
                <p className="font-semibold text-heading">{n.title || n.type}</p>
                <p className="text-sm text-body">{n.body || n.status}</p>
                <p className="mt-1 text-xs text-body">
                  {new Date(n.inserted_at).toLocaleString()}
                  {n.read_at ? " · read" : ""}
                </p>
              </div>
              {!n.read_at ? (
                <button
                  type="button"
                  onClick={() => markRead(n.id)}
                  className="rounded border border-border px-3 py-1 text-sm"
                >
                  Mark read
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
