import { useCallback, useEffect, useState } from 'react';

import { getSession, type Session } from '@/lib/api';
import { replacePath } from '@/lib/nav';
import { canAccessRoute } from '@/lib/rbac';

export type GateStatus = 'loading' | 'ready' | 'denied' | 'signedOut' | 'error';

/**
 * Resolves the session and RBAC for a screen.
 *
 * Screens used to redirect on denial and leave their local session `null`,
 * which rendered a spinner forever if the user navigated back to that tab —
 * the effect had already run, so nothing ever set the session. Reporting an
 * explicit `denied` status lets the screen show a real message and a way out.
 */
export function useScreenGate(route: string) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<GateStatus>('loading');
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let s: Session | null = null;
      try {
        s = await getSession();
      } catch {
        if (!cancelled) setStatus('error');
        return;
      }
      if (cancelled) return;

      if (!s) {
        setStatus('signedOut');
        replacePath('/landing');
        return;
      }
      if (!canAccessRoute(s, route)) {
        setStatus('denied');
        return;
      }
      setSession(s);
      setStatus('ready');
    })();
    return () => {
      cancelled = true;
    };
  }, [route, attempt]);

  return { session, status, retry };
}
