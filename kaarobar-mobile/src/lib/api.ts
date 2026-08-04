import AsyncStorage from "@react-native-async-storage/async-storage";

/** Kaarobar theme — keep in sync with kaarobar-web/app/globals.css */
export const colors = {
  brand: "#1d4ed8",
  brandHover: "#1e40af",
  brandSoft: "#dbeafe",
  brandLight: "#eff6ff",
  accent: "#0f766e",
  bgPrimary: "#f6f8fb",
  bgSecondary: "#ffffff",
  card: "#ffffff",
  glass: "rgba(255, 255, 255, 0.82)",
  glassBorder: "rgba(148, 163, 184, 0.28)",
  mesh1: "rgba(59, 130, 246, 0.14)",
  mesh2: "rgba(15, 118, 110, 0.08)",
  border: "#e2e8f0",
  heading: "#0f172a",
  body: "#475569",
  muted: "#94a3b8",
  sidebar: "#0b1220",
  sidebarMuted: "#94a3b8",
  danger: "#dc2626",
  success: "#15803d",
  white: "#ffffff",
  radiusLg: 12,
} as const;

export const API_URL =
  process.env.API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://localhost:4000/api/v1";

export type AuthActor = "business" | "consumer";

export type BuyerMembership = {
  customer_id: string;
  business_id: string;
  business_name?: string | null;
  loyalty_points?: number;
  portal_enabled?: boolean;
};

export type Session = {
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
  /** Owner-scoped plan entitlements (ADM-FR-002). */
  entitled_bundles?: string[];
  allows_fbr?: boolean;
  subscription_plan?: string;
};

const SESSION_KEY = "kaarobar_session";

let memorySession: Session | null = null;
let refreshPromise: Promise<Session | null> | null = null;
let sessionTimedOut = false;

export function isConsumerSession(session?: Session | null): boolean {
  return (session ?? memorySession)?.actor === "consumer";
}

export async function getSession(): Promise<Session | null> {
  if (memorySession) return memorySession;
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    memorySession = JSON.parse(raw) as Session;
    return memorySession;
  } catch {
    return memorySession;
  }
}

export async function setSession(session: Session) {
  memorySession = session;
  try {
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // memory fallback
  }
}

export async function clearSession() {
  memorySession = null;
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export function markSessionTimedOut() {
  sessionTimedOut = true;
}

export function consumeSessionTimedOut(): boolean {
  const value = sessionTimedOut;
  sessionTimedOut = false;
  return value;
}

function shouldAttemptRefresh(path: string): boolean {
  return path !== "/auth/login" && path !== "/auth/refresh";
}

async function refreshAccessToken(session: Session): Promise<Session | null> {
  if (!session.refresh_token || isConsumerSession(session)) return null;
  const headers = new Headers({ "Content-Type": "application/json" });
  if (session.business_id) headers.set("x-business-id", session.business_id);
  if (session.branch_id) headers.set("x-branch-id", session.branch_id);
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
  await setSession(next);
  return next;
}

async function withRefresh(session: Session): Promise<Session | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken(session).finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  session?: Session | null
): Promise<T> {
  const makeRequest = async (current: Session | null | undefined) => {
    const headers = new Headers(init.headers);
    const isFormData =
      typeof FormData !== "undefined" && init.body instanceof FormData;
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
    const res = await fetch(`${API_URL}${path}`, { ...init, headers });
    const text = await res.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    return { res, body };
  };

  let current = session === undefined ? await getSession() : session;
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
      markSessionTimedOut();
      await clearSession();
      throw new Error("session_timeout");
    }
  }

  if (!res.ok) {
    if (res.status === 401 && session === undefined) {
      markSessionTimedOut();
      await clearSession();
    }
    const payload =
      body && typeof body === "object" ? (body as Record<string, unknown>) : null;
    const apiError =
      (typeof payload?.error === "string" && payload.error) ||
      (typeof payload?.message === "string" && payload.message);
    if (apiError) throw new Error(apiError);
    if (typeof body === "string" && body.trim().startsWith("<")) {
      throw new Error(
        `Server returned HTML instead of JSON (${res.status}). Check API_URL.`
      );
    }
    throw new Error(`Request failed (${res.status})`);
  }
  return body as T;
}

export async function hydrateSessionContext(session: Session): Promise<Session> {
  if (isConsumerSession(session)) {
    try {
      const me = await api<{
        data: {
          account: NonNullable<Session["account"]>;
          memberships: BuyerMembership[];
        };
      }>("/portal/me", {}, session);
      const merged: Session = {
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
      await setSession(merged);
      return merged;
    } catch {
      return session;
    }
  }

  const me = await api<{
    user: Session["user"];
    memberships: NonNullable<Session["memberships"]>;
  }>("/auth/me", {}, session);
  let merged: Session = {
    ...session,
    actor: "business",
    user: me.user,
    memberships: me.memberships || [],
  };

  try {
    const bill = await api<{
      data: {
        entitled_bundles?: string[];
        allows_fbr?: boolean;
        subscription?: { plan?: string; entitled_bundles?: string[]; allows_fbr?: boolean };
      };
    }>("/billing/subscription", {}, merged);
    merged = {
      ...merged,
      entitled_bundles:
        bill.data?.entitled_bundles ||
        bill.data?.subscription?.entitled_bundles ||
        [],
      allows_fbr:
        bill.data?.allows_fbr ?? bill.data?.subscription?.allows_fbr ?? false,
      subscription_plan: bill.data?.subscription?.plan,
    };
  } catch {
    // leave entitlements unset
  }

  await setSession(merged);
  return merged;
}

export async function logoutSession(session?: Session | null) {
  const current = session === undefined ? await getSession() : session;
  if (!current) {
    await clearSession();
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
    // Best-effort remote revoke.
  } finally {
    await clearSession();
  }
}

export async function billingCheckout(plan: string, redirectUrl?: string) {
  return api<{ data: { checkout_url: string } }>("/billing/checkout", {
    method: "POST",
    body: JSON.stringify({
      plan,
      redirect_url: redirectUrl,
    }),
  });
}

export async function campaignCheckout(campaignId: string, redirectUrl?: string) {
  return api<{
    data: {
      checkout_url: string;
      payment_id: string;
      dev_fallback?: boolean;
    };
  }>(`/crm/campaigns/${campaignId}/checkout`, {
    method: "POST",
    body: JSON.stringify({ redirect_url: redirectUrl }),
  });
}

export async function confirmCampaignPayment(campaignId: string, paymentId: string) {
  return api<{ data: unknown }>(`/crm/campaigns/${campaignId}/confirm-payment`, {
    method: "POST",
    body: JSON.stringify({ payment_id: paymentId }),
  });
}
