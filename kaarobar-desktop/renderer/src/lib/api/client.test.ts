import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, clearSession, getSession, setSession, type StoredSession } from "./client";

describe("desktop api client refresh flow", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    clearSession();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        hash: "#/app",
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  test("refreshes access token and retries request", async () => {
    const session: StoredSession = {
      actor: "business",
      access_token: "old-access",
      refresh_token: "refresh-1",
      user: { id: "u1", email: "u@test.local", name: "User" },
    };
    setSession(session);

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "token_expired" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "new-access" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: { ok: true } }),
      }) as unknown as typeof fetch;

    const result = await api<{ data: { ok: boolean } }>("/products");
    expect(result.data.ok).toBe(true);
    expect(getSession()?.access_token).toBe("new-access");
  });

  test("on refresh failure clears session and sends to login hash", async () => {
    const session: StoredSession = {
      actor: "business",
      access_token: "old-access",
      refresh_token: "refresh-1",
      user: { id: "u1", email: "u@test.local", name: "User" },
    };
    setSession(session);

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "token_expired" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "invalid_refresh_token" }),
      }) as unknown as typeof fetch;

    await expect(api("/products")).rejects.toThrowError("session_timeout");
    expect(getSession()).toBeNull();
    expect(window.location.hash).toBe("#/login?reason=session_timeout");
  });
});
