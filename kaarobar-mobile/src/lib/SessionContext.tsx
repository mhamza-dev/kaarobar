import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    ReactNode,
} from "react";
import {
    getSession,
    setSession as apiSetSession,
    logoutSession,
    type Session,
} from "./api";

type SessionContextValue = {
    session: Session | null;
    setSession: (s: Session) => Promise<void>;
    logout: () => Promise<void>;
    loading: boolean; // true until the initial storage read finishes
};

const SessionContext = createContext<SessionContextValue>({
    session: null,
    setSession: async () => { },
    logout: async () => { },
    loading: true,
});

export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }: { children: ReactNode }) {
    const [session, setSessionState] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // Initial load from secure storage
    useEffect(() => {
        (async () => {
            const s = await getSession();
            setSessionState(s);
            setLoading(false);
        })();
    }, []);

    const setSession = async (s: Session) => {
        await apiSetSession(s); // persist
        setSessionState(s); // update the context immediately
    };

    const logout = async () => {
        await logoutSession();
        setSessionState(null);
    };

    console.log("session in context -->", session);
    console.log("loading in context -->", loading);

    return (
        <SessionContext.Provider value={{ session, setSession, logout, loading }}>
            {children}
        </SessionContext.Provider>
    );
}