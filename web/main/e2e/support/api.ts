import type { APIRequestContext, Page } from "@playwright/test";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/**
 * Talks to the backend directly as the signed-in user — for setting up
 * state a spec needs but no screen creates (a batch arrives on a delivery
 * the demo seed didn't make). Reuses the session the browser already holds,
 * so it acts with exactly the same permissions and tenant as the page.
 */
export async function apiAs(page: Page, businessName = "Bilal Kiryana Store") {
  const cookies = await page.context().cookies();
  const token = cookies.find((cookie) => cookie.name === "kb_session")?.value;
  if (!token) throw new Error("apiAs: not signed in (no kb_session cookie)");

  const request: APIRequestContext = page.request;
  const auth = { Authorization: `Bearer ${decodeURIComponent(token)}` };

  const me = await request.get(`${API_URL}/me`, { headers: auth });
  const scope = (await me.json()).data;
  const orgHeaders = { ...auth, "X-Organization-Id": scope.organization.id };

  // An owner has no business of their own in scope — pick one, as the
  // business switcher does. Business-scoped endpoints refuse to run without.
  const businesses = await request.get(`${API_URL}/businesses`, { headers: orgHeaders });
  const business = ((await businesses.json()).data as Array<{ id: string; name: string }>).find(
    (candidate) => candidate.name === businessName,
  );
  if (!business) throw new Error(`apiAs: no business named ${businessName}`);
  const headers: Record<string, string> = { ...orgHeaders, "X-Business-Id": business.id };

  const unwrap = async (response: Awaited<ReturnType<APIRequestContext["get"]>>) => {
    const text = await response.text();
    if (!response.ok()) throw new Error(`${response.status()} ${response.url()}: ${text.slice(0, 300)}`);
    return JSON.parse(text).data;
  };

  return {
    scope,
    get: async (path: string, params?: Record<string, string>) =>
      unwrap(await request.get(`${API_URL}${path}`, { headers, params })),
    post: async (path: string, data: unknown) =>
      unwrap(
        await request.post(`${API_URL}${path}`, {
          headers: { ...headers, "Idempotency-Key": crypto.randomUUID() },
          data,
        }),
      ),
  };
}
