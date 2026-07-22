const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api/v1";

export type PortalSession = {
  access_token: string;
  business_id: string;
  account: {
    id: string;
    email: string;
    email_verified: boolean;
    business_id: string;
    customer_id: string;
    customer_name?: string;
  };
};

const PORTAL_KEY = "kaarobar_portal_session";

export function getPortalSession(): PortalSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(PORTAL_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalSession;
  } catch {
    return null;
  }
}

export function setPortalSession(session: PortalSession) {
  localStorage.setItem(PORTAL_KEY, JSON.stringify(session));
}

export function clearPortalSession() {
  localStorage.removeItem(PORTAL_KEY);
}

export async function portalApi<T>(
  path: string,
  options: RequestInit = {},
  session?: PortalSession | null
): Promise<T> {
  const current = session === undefined ? getPortalSession() : session;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (current?.access_token) {
    headers.Authorization = `Bearer ${current.access_token}`;
  }
  if (current?.business_id) {
    headers["x-business-id"] = current.business_id;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || res.statusText || "request_failed");
  }
  return body as T;
}
