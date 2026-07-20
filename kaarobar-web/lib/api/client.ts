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
