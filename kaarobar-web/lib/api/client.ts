const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export type StoredSession = {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
  business_id?: string;
  branch_id?: string;
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
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
  session?: StoredSession | null
): Promise<T> {
  const current = session === undefined ? getSession() : session;
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
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
