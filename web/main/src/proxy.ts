import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Coarse, UX-only route protection — Next 16 renamed `middleware.ts` to
 * `proxy.ts` (same file-convention semantics; confirmed against
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md,
 * which also requires this file sit at the same directory level as `app/`,
 * i.e. inside `src/`).
 *
 * This is not the authorization boundary — it only checks that the
 * `kb_session` cookie is present, never decodes it (it's an opaque bearer
 * token). The real boundary is the backend, which validates the token on
 * every request regardless, and `(app)/layout.tsx`'s `GET /me` bootstrap,
 * which redirects on a 401. All this does is avoid rendering authenticated
 * shell chrome for a request that's obviously about to be redirected away.
 */
export function proxy(request: NextRequest) {
  const hasSession = request.cookies.has("kb_session");
  const { pathname, search } = request.nextUrl;

  if (!hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Every path except: /login, /register, /forgot-password,
     * /reset-password (the (auth) group), /invite/* (public), /api/*,
     * Next internals, and static assets.
     */
    "/((?!login|register|forgot-password|reset-password|invite|api|_next/static|_next/image|favicon.ico).*)",
  ],
};
