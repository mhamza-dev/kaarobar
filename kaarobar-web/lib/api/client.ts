const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export type StoredSession = {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
    locale?: "en" | "ur";
  };
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

/** Pick default business + branch and persist on the session before tenant-scoped API calls. */
export async function bootstrapTenantSession(
  session: StoredSession
): Promise<StoredSession> {
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
  const me = await api<{
    user: StoredSession["user"];
    memberships: NonNullable<StoredSession["memberships"]>;
  }>("/auth/me", {}, session);
  const merged: StoredSession = {
    ...session,
    user: me.user,
    memberships: me.memberships || [],
  };
  return bootstrapTenantSession(merged);
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  session?: StoredSession | null
): Promise<T> {
  const current = session === undefined ? getSession() : session;
  const headers = new Headers(init.headers);
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (current?.access_token) {
    headers.set("Authorization", `Bearer ${current.access_token}`);
  }
  if (current?.business_id) headers.set("x-business-id", current.business_id);
  if (current?.branch_id) headers.set("x-branch-id", current.branch_id);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }
  if (!res.ok) {
    const err = body as { error?: string; message?: string } | null;
    throw new Error(err?.error || err?.message || `Request failed (${res.status})`);
  }
  return body as T;
}
