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

export type Session = {
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
};

const SESSION_KEY = "kaarobar_session";

let memorySession: Session | null = null;

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
  if (current?.branch_id) headers.set("x-branch-id", current.branch_id);

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(body?.error || body?.message || `Request failed (${res.status})`);
  }
  return body as T;
}
