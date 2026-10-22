import axios from "axios";

import { env } from "@/lib/env";
import { getTenantHeaders, useSessionStore } from "@/stores/sessionStore";

import { toApiError } from "./errors";

const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);

/**
 * The one axios instance every service module goes through.
 *
 * Deliberately does **not** unwrap `{"data": ...}` in a response interceptor:
 * a single-resource endpoint's body is `{"data": T}`, but a list endpoint's
 * is `{"data": T[], "meta": {...}}` — unwrapping `response.data.data`
 * generically would silently drop `meta` for every paginated call. Each
 * service function unwraps explicitly instead (`r.data.data` for a resource,
 * `r.data` — kept whole — for a page). See `src/services/staff.ts` for the
 * pattern.
 */
export const apiClient = axios.create({
  baseURL: env.apiUrl,
});

apiClient.interceptors.request.use((config) => {
  const { token } = useSessionStore.getState();

  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }

  for (const [header, value] of Object.entries(getTenantHeaders())) {
    config.headers.set(header, value);
  }

  // The backend honours Idempotency-Key on every write — a retried request
  // from a flaky connection must not double-charge or double-submit.
  const method = config.method?.toLowerCase();
  if (method && WRITE_METHODS.has(method) && !config.headers.has("Idempotency-Key")) {
    config.headers.set("Idempotency-Key", crypto.randomUUID());
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const apiError = toApiError(error);

    // A 401 on the login/verify calls themselves is a wrong-credentials
    // response, not a session expiry — redirecting there would loop. Same for
    // the calls that spend a token from an email: an expired reset or
    // confirmation link answers 401 `invalid_token`, which the page has to
    // show, not treat as the reader's session ending.
    const url = error?.config?.url as string | undefined;
    const isAuthCall = [
      "/auth/login",
      "/auth/mfa/verify",
      "/auth/confirm",
      "/auth/reset-password",
      "/invitations/",
    ].some((path) => url?.includes(path));

    if (apiError.status === 401 && !isAuthCall) {
      useSessionStore.getState().clear();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        // A hard navigation, deliberately — not `useRouter().push()`. This
        // runs in a module-level interceptor with no router in scope, and a
        // dead session should wipe every in-memory cache (React Query,
        // zustand) on the way out rather than leave the previous user's
        // data sitting behind the login screen.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
    }

    // The organization's subscription has lapsed: the API now refuses
    // everything but billing and the account. Send the user to the one
    // screen that can fix it rather than leaving every page to fail on its
    // own. Hard navigation for the same reason as the 401 above.
    if (apiError.code === "subscription_expired" && typeof window !== "undefined") {
      if (!window.location.pathname.startsWith("/settings/billing")) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/settings/billing";
      }
    }

    return Promise.reject(apiError);
  },
);
