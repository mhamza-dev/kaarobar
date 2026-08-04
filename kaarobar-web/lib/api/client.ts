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
  refresh_token?: string;
  actor?: AuthActor;
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
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
  /** Owner-scoped plan entitlements (ADM-FR-002). */
  entitled_bundles?: string[];
  allows_fbr?: boolean;
  subscription_plan?: string;
};

const SESSION_KEY = "kaarobar_session";
const SESSION_TIMEOUT_REASON = "session_timeout";
let refreshPromise: Promise<StoredSession | null> | null = null;

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

function redirectToLoginWithTimeout() {
  if (typeof window === "undefined") return;
  const next = `/login?reason=${SESSION_TIMEOUT_REASON}`;
  if (window.location.pathname !== "/login") {
    window.location.assign(next);
  } else {
    const url = new URL(window.location.href);
    url.searchParams.set("reason", SESSION_TIMEOUT_REASON);
    window.history.replaceState({}, "", url.toString());
  }
}

function shouldAttemptRefresh(path: string): boolean {
  return path !== "/auth/login" && path !== "/auth/refresh";
}

async function refreshAccessToken(
  session: StoredSession
): Promise<StoredSession | null> {
  if (!session.refresh_token) return null;

  const headers = new Headers({ "Content-Type": "application/json" });
  if (session.business_id && !isConsumerSession(session)) {
    headers.set("x-business-id", session.business_id);
  }
  if (session.branch_id && !isConsumerSession(session)) {
    headers.set("x-branch-id", session.branch_id);
  }

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers,
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) return null;

  const body = (await res.json().catch(() => null)) as
    | { access_token?: string }
    | null;
  if (!body?.access_token) return null;

  const next = { ...session, access_token: body.access_token };
  setSession(next);
  return next;
}

async function withRefresh(session: StoredSession): Promise<StoredSession | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(session).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
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
        business_id: undefined,
        branch_id: undefined,
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

  try {
    const bill = await api<{
      data: {
        entitled_bundles?: string[];
        allows_fbr?: boolean;
        subscription?: { plan?: string; entitled_bundles?: string[]; allows_fbr?: boolean };
      };
    }>("/billing/subscription", {}, merged);
    const entitled =
      bill.data?.entitled_bundles ||
      bill.data?.subscription?.entitled_bundles ||
      [];
    merged = {
      ...merged,
      entitled_bundles: entitled,
      allows_fbr:
        bill.data?.allows_fbr ?? bill.data?.subscription?.allows_fbr ?? false,
      subscription_plan: bill.data?.subscription?.plan,
    };
    setSession(merged);
  } catch {
    // Billing may be unavailable; leave entitled_bundles unset (fail-open until loaded).
  }

  return merged;
}

export async function logoutSession(session?: StoredSession | null) {
  const current = session === undefined ? getSession() : session;
  if (!current) {
    clearSession();
    return;
  }

  try {
    if (!isConsumerSession(current) && current.refresh_token) {
      const headers = new Headers({
        "Content-Type": "application/json",
        Authorization: `Bearer ${current.access_token}`,
      });
      if (current.business_id) headers.set("x-business-id", current.business_id);
      if (current.branch_id) headers.set("x-branch-id", current.branch_id);
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers,
        body: JSON.stringify({ refresh_token: current.refresh_token }),
      });
    } else if (isConsumerSession(current)) {
      const headers = new Headers({
        "Content-Type": "application/json",
        Authorization: `Bearer ${current.access_token}`,
      });
      await fetch(`${API_URL}/portal/auth/logout`, { method: "POST", headers });
    }
  } catch {
    // Best-effort remote revoke, then local clear.
  } finally {
    clearSession();
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  session?: StoredSession | null
): Promise<T> {
  const makeRequest = async (current: StoredSession | null | undefined) => {
    const headers = new Headers(options.headers);
    const isFormData =
      typeof FormData !== "undefined" && options.body instanceof FormData;
    if (!isFormData && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    if (current?.access_token) {
      headers.set("Authorization", `Bearer ${current.access_token}`);
    }
    if (current?.business_id && !isConsumerSession(current)) {
      headers.set("x-business-id", current.business_id);
    }
    if (current?.branch_id && !isConsumerSession(current)) {
      headers.set("x-branch-id", current.branch_id);
    }
    const res = await fetch(`${API_URL}${path}`, { ...options, headers });
    const body = await res.json().catch(() => ({}));
    return { res, body };
  };

  let current = session === undefined ? getSession() : session;
  let { res, body } = await makeRequest(current);

  if (
    res.status === 401 &&
    current &&
    shouldAttemptRefresh(path) &&
    !isConsumerSession(current)
  ) {
    const refreshed = await withRefresh(current);
    if (refreshed) {
      ({ res, body } = await makeRequest(refreshed));
    } else if (session === undefined) {
      clearSession();
      redirectToLoginWithTimeout();
      throw new Error("session_timeout");
    }
  }

  if (!res.ok) {
    if (res.status === 401 && session === undefined) {
      clearSession();
      redirectToLoginWithTimeout();
    }
    throw new Error(
      (body as { error?: string }).error || res.statusText || "request_failed"
    );
  }
  return body as T;
}

/** Walk cursor pages until exhausted (server default page size is 25, max 200). */
export async function apiAllPages<T>(
  path: string,
  options: RequestInit = {},
  session?: StoredSession | null,
  pageLimit = 200
): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const rows: T[] = [];
  let cursor: string | null = null;

  for (;;) {
    const qs: string = `limit=${pageLimit}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`;
    const res: { data: T[]; meta?: { next_cursor?: string | null } } = await api<{
      data: T[];
      meta?: { next_cursor?: string | null };
    }>(`${path}${sep}${qs}`, options, session);
    rows.push(...(res.data || []));
    cursor = res.meta?.next_cursor ?? null;
    if (!cursor || !(res.data || []).length) break;
  }

  return rows;
}
