"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import { SurfaceCard } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";

export type NotificationPrefs = {
  email: boolean;
  in_app: boolean;
  push: boolean;
  muted_types: string[];
};

const MUTE_OPTIONS = [
  { id: "leave_request", label: "Leave requests" },
  { id: "leave.approved", label: "Leave approved" },
  { id: "leave.rejected", label: "Leave rejected" },
  { id: "payroll.pending", label: "Payroll pending" },
  { id: "payroll.approved", label: "Payroll approved" },
  { id: "billing.limit", label: "Billing / plan limits" },
  { id: "return.pending", label: "Returns pending" },
  { id: "return.approved", label: "Returns approved" },
  { id: "return.rejected", label: "Returns rejected" },
  { id: "inventory.low_stock", label: "Low stock" },
  { id: "transfer.pending", label: "Transfers pending" },
  { id: "transfer.confirmed", label: "Transfers confirmed" },
  { id: "discount.approval_needed", label: "Discount approvals" },
] as const;

type Props = {
  className?: string;
};

export default function NotificationPreferencesPanel({ className = "" }: Props) {
  const toast = useToast();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ data: NotificationPrefs }>("/notification-preferences");
      setPrefs(res.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load preferences");
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(next: NotificationPrefs) {
    setSaving(true);
    try {
      const res = await api<{ data: NotificationPrefs }>("/notification-preferences", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setPrefs(res.data);
      toast.success("Notification preferences saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save preferences");
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(key: keyof Pick<NotificationPrefs, "email" | "in_app" | "push">) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    void save(next);
  }

  function toggleMute(type: string) {
    if (!prefs) return;
    const muted = new Set(prefs.muted_types || []);
    if (muted.has(type)) muted.delete(type);
    else muted.add(type);
    const next = { ...prefs, muted_types: Array.from(muted) };
    setPrefs(next);
    void save(next);
  }

  async function enableOutAppPermission() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      toast.warning("This browser does not support notification bar alerts.");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      toast.warning("Notification permission was not granted.");
      return;
    }
    if (prefs && !prefs.push) {
      toggleChannel("push");
    } else {
      toast.success("Push notifications enabled for this browser.");
    }
  }

  if (!prefs) {
    return (
      <SurfaceCard className={`p-5 ${className}`}>
        <p className="text-sm text-body">Loading preferences…</p>
      </SurfaceCard>
    );
  }

  return (
    <SurfaceCard className={`space-y-6 p-5 ${className}`}>
      <div>
        <h2 className="font-semibold text-heading">Notification channels</h2>
        <p className="mt-1 text-sm text-body">
          Choose how Kaarobar reaches you. In-app is your inbox; push is the OS / browser
          notification bar (and mobile push).
        </p>
      </div>

      <div className="space-y-3">
        {(
          [
            ["email", "Email", "Send alerts to your account email"],
            ["in_app", "In-app", "Show alerts in the Notifications inbox"],
            [
              "push",
              "Push",
              "Show alerts when the app is closed or in the background",
            ],
          ] as const
        ).map(([key, label, hint]) => (
          <label
            key={key}
            className="flex cursor-pointer items-start justify-between gap-4 rounded-md border border-border bg-card-muted px-4 py-3"
          >
            <span>
              <span className="block font-medium text-heading">{label}</span>
              <span className="mt-0.5 block text-sm text-body">{hint}</span>
            </span>
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={prefs[key]}
              disabled={saving}
              onChange={() => toggleChannel(key)}
            />
          </label>
        ))}
      </div>

      <div>
        <Button type="button" variant="secondary" size="sm" onClick={() => void enableOutAppPermission()}>
          Allow browser / OS push notifications
        </Button>
      </div>

      <div>
        <h3 className="font-semibold text-heading">Mute categories</h3>
        <p className="mt-1 text-sm text-body">Turn off specific event types across all channels.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MUTE_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
            >
              <span className="text-heading">{opt.label}</span>
              <input
                type="checkbox"
                checked={(prefs.muted_types || []).includes(opt.id)}
                disabled={saving}
                onChange={() => toggleMute(opt.id)}
              />
            </label>
          ))}
        </div>
      </div>
    </SurfaceCard>
  );
}
