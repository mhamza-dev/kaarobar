import { create } from "zustand";

import type { Scope } from "@/types/api/me";

const TOKEN_COOKIE = "kb_session";

export type TenantSelection = {
  organizationId?: string;
  businessId?: string;
  branchId?: string;
};

/**
 * The bearer token, the resolved `/me` scope, and the caller's tenant
 * selection.
 *
 * A plain zustand store (not React Query) because `src/lib/api/client.ts`'s
 * axios interceptor needs to read the token and the `X-Organization-Id` /
 * `X-Business-Id` / `X-Branch-Id` header values synchronously, outside any
 * component — `useSessionStore.getState()` works from a module-level
 * interceptor; a React Query cache read does not.
 *
 * The token also lives in a JS-readable cookie (not httpOnly) so
 * `src/proxy.ts` can do a coarse, UX-only presence check before rendering
 * shell chrome the user is about to be redirected away from — it is not the
 * authorization boundary. The real boundary is the backend (validates the
 * token on every request regardless) and `(app)/layout.tsx`'s `GET /me`
 * bootstrap.
 */
type SessionState = {
  token: string | null;
  scope: Scope | null;
  /** True once `GET /me` has resolved at least once this session. */
  hydrated: boolean;
  /**
   * Set by `BusinessSwitcher` before refetching `/me` — the header values a
   * tenant switch should use *before* the backend has confirmed it, since
   * `scope` still reflects the outgoing tenant until that response lands.
   * Cleared once `setScope` sees the switch reflected.
   */
  pendingSelection: TenantSelection | null;
  /**
   * Whether `useSessionBootstrap` has already tried to auto-adopt a business
   * for this session. Lives here rather than in the hook because it has to
   * survive the `/me` refetch that adoption triggers — without it, a backend
   * that refuses the business it just listed would put the bootstrap in an
   * endless select-refetch loop.
   */
  businessAdoptionAttempted: boolean;

  setToken: (token: string) => void;
  setScope: (scope: Scope) => void;
  selectTenant: (selection: TenantSelection) => void;
  markBusinessAdoptionAttempted: () => void;
  clear: () => void;
};

function readTokenCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${TOKEN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeTokenCookie(token: string | null) {
  if (typeof document === "undefined") return;
  if (token) {
    const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
    document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; SameSite=Lax; max-age=${60 * 60 * 24 * 30}${secure}`;
  } else {
    document.cookie = `${TOKEN_COOKIE}=; path=/; SameSite=Lax; max-age=0`;
  }
}

export const useSessionStore = create<SessionState>((set) => ({
  token: readTokenCookie(),
  scope: null,
  hydrated: false,
  pendingSelection: null,
  businessAdoptionAttempted: false,

  setToken: (token) => {
    writeTokenCookie(token);
    set({ token });
  },

  setScope: (scope) => set({ scope, hydrated: true, pendingSelection: null }),

  selectTenant: (selection) => set({ pendingSelection: selection }),

  markBusinessAdoptionAttempted: () => set({ businessAdoptionAttempted: true }),

  clear: () => {
    writeTokenCookie(null);
    set({
      token: null,
      scope: null,
      hydrated: false,
      pendingSelection: null,
      businessAdoptionAttempted: false,
    });
  },
}));

/**
 * Header values the axios request interceptor attaches to every call.
 *
 * While a switch is pending, the pending selection is taken *as a whole*:
 * the outgoing tenant's business and branch must not leak into the first
 * request for the new one. Switching organization with no business named
 * sends no business; switching business sends no branch — the backend then
 * resolves the defaults for the new tenant rather than rejecting a branch
 * that belongs to the old one.
 */
export function getTenantHeaders(): Record<string, string> {
  const { scope, pendingSelection } = useSessionStore.getState();
  const organizationId = pendingSelection?.organizationId ?? scope?.organization?.id;
  const businessId = pendingSelection
    ? (pendingSelection.businessId ??
      (pendingSelection.organizationId ? undefined : scope?.business?.id))
    : scope?.business?.id;
  const branchId = pendingSelection ? pendingSelection.branchId : scope?.branch?.id;

  const headers: Record<string, string> = {};
  if (organizationId) headers["X-Organization-Id"] = organizationId;
  if (businessId) headers["X-Business-Id"] = businessId;
  if (branchId) headers["X-Branch-Id"] = branchId;
  return headers;
}

const LAST_BUSINESS_KEY = "kb_last_business";

/**
 * The business this browser last worked in, per organization — so a
 * reload lands back where the user was rather than on the organization's
 * first business. Per-browser convenience only; never a source of truth
 * (the backend still decides whether the id is valid for this user).
 */
export function rememberBusiness(organizationId: string, businessId: string): void {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_BUSINESS_KEY) ?? "{}");
    localStorage.setItem(
      LAST_BUSINESS_KEY,
      JSON.stringify({ ...stored, [organizationId]: businessId }),
    );
  } catch {
    // Storage unavailable (private mode, blocked) — landing on the first
    // business is an acceptable fallback.
  }
}

export function rememberedBusiness(organizationId: string): string | null {
  try {
    const stored = JSON.parse(localStorage.getItem(LAST_BUSINESS_KEY) ?? "{}");
    return typeof stored[organizationId] === "string" ? stored[organizationId] : null;
  } catch {
    return null;
  }
}
