import { api, clearSession, getSession, setSession, type StoredSession } from "./client";

describe("web api client refresh flow", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    localStorage.clear();
    clearSession();
    window.history.pushState({}, "", "/app");
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  test("refreshes and retries once on 401", async () => {
    const session: StoredSession = {
      actor: "business",
      access_token: "old-access",
      refresh_token: "refresh-1",
      user: { id: "u1", email: "u@test.local", name: "User" },
    };
    setSession(session);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "token_expired" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "new-access" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: ["ok"] }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await api<{ data: string[] }>("/products");
    expect(result.data).toEqual(["ok"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(getSession()?.access_token).toBe("new-access");
  });

  test("clears session and redirects when refresh fails", async () => {
    const session: StoredSession = {
      actor: "business",
      access_token: "old-access",
      refresh_token: "refresh-1",
      user: { id: "u1", email: "u@test.local", name: "User" },
    };
    setSession(session);

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "token_expired" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: "invalid_refresh_token" }),
      }) as unknown as typeof fetch;

    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(api("/products")).rejects.toThrow("session_timeout");
    errorSpy.mockRestore();
    expect(getSession()).toBeNull();
  });
});
