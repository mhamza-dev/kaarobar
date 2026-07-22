const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export type AuthActor = "business" | "consumer";

export type BuyerMembership = {
  customer_id: string;
  business_id: string;
  business_name?: string | null;
  loyalty_points?: number;
  portal_enabled?: boolean;
};

export type StoredSession = {
  access_token: string;
  actor?: AuthActor;
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
    locale?: "en" | "ur";
    profile_pic_url?: string | null;
  };
  /** Buyer account (when actor=consumer) */
  account?: {
    id: string;
    email: string;
    name?: string | null;
    phone?: string | null;
    email_verified?: boolean;
  };
  buyer_memberships?: BuyerMembership[];
  business_id?: string;
  branch_id?: string;
  memberships?: {
    id: string;
    business_id: string;
    branch_id?: string | null;
    roles: string[];
    status: string;
    business_name?: string | null;
    branch_name?: string | null;
  }[];
  role_settings?: Record<string, Record<string, boolean>>;
};

const SESSION_KEY = "kaarobar_session";

export function getSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function setSession(session: StoredSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kaarobar:session", { detail: session }));
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("kaarobar:session", { detail: null }));
  }
}

export function isConsumerSession(session?: StoredSession | null): boolean {
  const s = session === undefined ? getSession() : session;
  return s?.actor === "consumer";
}

/** Pick default business + branch and persist on the session before tenant-scoped API calls. */
export async function bootstrapTenantSession(
  session: StoredSession
): Promise<StoredSession> {
  if (isConsumerSession(session)) return session;
  if (session.business_id && session.branch_id) return session;

  try {
    const bizRes = await api<{ data: { id: string }[] }>("/businesses", {}, session);
    const businesses = bizRes.data || [];
    if (businesses.length === 0) return session;

    const business_id = session.business_id || businesses[0].id;
    let next: StoredSession = { ...session, business_id };

    if (!next.branch_id) {
      const brRes = await api<{ data: { id: string }[] }>(
        `/businesses/${business_id}/branches`,
        {},
        next
      );
      const branches = brRes.data || [];
      if (branches[0]) {
        next = { ...next, branch_id: branches[0].id };
      }
    }

    if (
      next.business_id !== session.business_id ||
      next.branch_id !== session.branch_id
    ) {
      setSession(next);
    }
    return next;
  } catch {
    return session;
  }
}

export async function hydrateSessionContext(
  session: StoredSession
): Promise<StoredSession> {
  if (isConsumerSession(session)) {
    // Refresh buyer profile via portal me
    try {
      const me = await api<{
        data: {
          account: NonNullable<StoredSession["account"]>;
          memberships: BuyerMembership[];
        };
      }>("/portal/me", {}, session);
      const merged: StoredSession = {
        ...session,
        actor: "consumer",
        account: me.data.account,
        buyer_memberships: me.data.memberships || [],
        user: {
          id: me.data.account.id,
          email: me.data.account.email,
          name: me.data.account.name || me.data.account.email,
          phone: me.data.account.phone,
        },
      };
      setSession(merged);
      return merged;
    } catch {
      return session;
    }
  }

  const me = await api<{
    user: StoredSession["user"];
    memberships: NonNullable<StoredSession["memberships"]>;
  }>("/auth/me", {}, session);
  let merged: StoredSession = {
    ...session,
    actor: "business",
    user: me.user,
    memberships: me.memberships || [],
  };
  merged = await bootstrapTenantSession(merged);

  if (merged.business_id) {
    try {
      const roleSettings = await api<{ data: { roles: Record<string, Record<string, boolean>> } }>(
        `/businesses/${merged.business_id}/role-settings`,
        {},
        merged
      );
      merged = { ...merged, role_settings: roleSettings.data?.roles || {} };
      setSession(merged);
    } catch {
      // Non-owner users may not have access to role-settings endpoint.
    }
  }

  return merged;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  session?: StoredSession | null
): Promise<T> {
  const current = session === undefined ? getSession() : session;
  const headers = new Headers(options.headers);
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (current?.access_token) {
    headers.set("Authorization", `Bearer ${current.access_token}`);
  }
  if (current?.business_id) {
    headers.set("x-business-id", current.business_id);
  }
  if (current?.branch_id && !isConsumerSession(current)) {
    headers.set("x-branch-id", current.branch_id);
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error || res.statusText || "request_failed"
    );
  }
  return body as T;
}
