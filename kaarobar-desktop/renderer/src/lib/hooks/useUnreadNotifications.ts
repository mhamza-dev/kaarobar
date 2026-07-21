import { useCallback, useEffect, useRef, useState } from "react";
import { api, getSession } from "@/lib/api/client";

type UnreadPayload = { data: { unread: number } };

/**
 * Polls unread in-app notification count and optionally fires OS notifications
 * when push is enabled and count increases.
 */
export function useUnreadNotifications(opts?: {
  intervalMs?: number;
  enableOsToast?: boolean;
}) {
  const intervalMs = opts?.intervalMs ?? 45000;
  const enableOsToast = opts?.enableOsToast ?? true;
  const [unread, setUnread] = useState(0);
  const prev = useRef(0);
  const outApp = useRef(true);

  const refresh = useCallback(async () => {
    if (!getSession()?.access_token) {
      setUnread(0);
      return 0;
    }
    try {
      const res = await api<UnreadPayload>("/notifications/unread-count");
      const count = res.data?.unread ?? 0;

      if (enableOsToast && outApp.current && count > prev.current && typeof window !== "undefined") {
        if ("Notification" in window && Notification.permission === "granted") {
          const delta = count - prev.current;
          new Notification("Kaarobar", {
            body:
              delta === 1
                ? "You have a new notification"
                : `You have ${delta} new notifications`,
            tag: "kaarobar-unread",
          });
        }
      }

      prev.current = count;
      setUnread(count);
      return count;
    } catch {
      return prev.current;
    }
  }, [enableOsToast]);

  useEffect(() => {
    void (async () => {
      try {
        const pref = await api<{ data: { push?: boolean } }>(
          "/notification-preferences"
        );
        outApp.current = pref.data?.push !== false;
      } catch {
        outApp.current = true;
      }
      await refresh();
    })();

    const id = window.setInterval(() => void refresh(), intervalMs);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("kaarobar:notifications-changed", onFocus);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("kaarobar:notifications-changed", onFocus);
    };
  }, [intervalMs, refresh]);

  return { unread, refresh };
}

export function notifyNotificationsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("kaarobar:notifications-changed"));
  }
}
