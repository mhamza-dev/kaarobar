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
  border: "#e2e8f0",
  heading: "#0f172a",
  body: "#475569",
  muted: "#94a3b8",
  sidebar: "#0b1220",
  sidebarMuted: "#94a3b8",
  danger: "#dc2626",
  success: "#15803d",
  white: "#ffffff",
} as const;

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000/api/v1";

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
  actor?: AuthActor;
  user: {
    id: string;
    email: string;
    name: string;
    phone?: string | null;
    locale?: "en" | "ur";
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
};

const SESSION_KEY = "kaarobar_session";

let memorySession: Session | null = null;

export function isConsumerSession(session?: Session | null): boolean {
  return (session ?? memorySession)?.actor === "consumer";
}

export async function getSession(): Promise<Session | null> {
  if (memorySession) return memorySession;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage"))
      .default;
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
    const AsyncStorage = (await import("@react-native-async-storage/async-storage"))
      .default;
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // memory fallback
  }
}

export async function clearSession() {
  memorySession = null;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage"))
      .default;
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  session?: Session | null
): Promise<T> {
  const current = session === undefined ? await getSession() : session;
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
  if (current?.branch_id && !isConsumerSession(current)) {
    headers.set("x-branch-id", current.branch_id);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(body?.error || body?.message || `Request failed (${res.status})`);
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
  return { ...session, actor: "business", user: me.user, memberships: me.memberships || [] };
}
