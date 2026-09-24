"use client";

import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { getSocket } from "@/lib/realtime";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Refetches a query whenever a Phoenix channel says its data moved.
 *
 * The backend's broadcasts carry no payload worth trusting on their own —
 * `board_changed` on `kds:<branch>` is just "look again" — so the REST
 * query stays the one source of truth and the channel only says when to
 * re-ask. Returns whether the channel is joined, so a screen can admit when
 * it has fallen back to polling.
 */
export function useChannelRefresh(
  topic: string | null,
  event: string,
  queryKey: QueryKey,
): boolean {
  const token = useSessionStore((state) => state.token);
  const queryClient = useQueryClient();
  const [joined, setJoined] = useState(false);
  const keyHash = JSON.stringify(queryKey);

  useEffect(() => {
    if (!topic || !token) return;

    const channel = getSocket(token).channel(topic);
    const ref = channel.on(event, () => {
      queryClient.invalidateQueries({ queryKey: JSON.parse(keyHash) as QueryKey });
    });

    channel
      .join()
      .receive("ok", () => setJoined(true))
      .receive("error", () => setJoined(false));
    channel.onError(() => setJoined(false));

    return () => {
      channel.off(event, ref);
      channel.leave();
      setJoined(false);
    };
  }, [topic, token, event, keyHash, queryClient]);

  return joined;
}
