import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  getSession,
  logoutSession,
  setSession as apiSetSession,
  type Session,
} from '@/lib/api';

type SessionContextValue = {
  session: Session | null;
  setSession: (s: Session) => Promise<void>;
  logout: () => Promise<void>;
  /** True until the initial storage read finishes. */
  loading: boolean;
};

const SessionContext = createContext<SessionContextValue>({
  session: null,
  setSession: async () => {},
  logout: async () => {},
  loading: true,
});

export const useSession = () => use(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const s = await getSession();
      if (cancelled) return;
      setSessionState(s);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setSession = useCallback(async (s: Session) => {
    await apiSetSession(s);
    setSessionState(s);
  }, []);

  const logout = useCallback(async () => {
    await logoutSession();
    setSessionState(null);
  }, []);

  const value = useMemo(
    () => ({ session, setSession, logout, loading }),
    [session, setSession, logout, loading],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

/** True when a staff (non-consumer) session is active. */
export function useIsStaffAuthed() {
  const { session } = useSession();
  return !!session?.access_token && session.actor !== 'consumer';
}
