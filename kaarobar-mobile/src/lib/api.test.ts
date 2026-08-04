const mockStorage = new Map<string, string>();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
  removeItem: jest.fn(async (key: string) => {
    mockStorage.delete(key);
  }),
}));

import {
  api,
  clearSession,
  consumeSessionTimedOut,
  getSession,
  setSession,
  type Session,
} from "./api";

describe("mobile api refresh behavior", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    mockStorage.clear();
    await clearSession();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("retries request after successful refresh for staff session", async () => {
    const session: Session = {
      actor: "business",
      access_token: "old-access",
      refresh_token: "refresh-1",
      user: { id: "u1", email: "u@test.local", name: "User" },
    };

    global.fetch = jest
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
        text: async () => JSON.stringify({ data: [1] }),
      }) as unknown as typeof fetch;

    const response = await api<{ data: number[] }>("/products", {}, session);
    expect(response.data).toEqual([1]);
  });

  test("marks timeout and clears session when refresh fails", async () => {
    const session: Session = {
      actor: "business",
      access_token: "old-access",
      refresh_token: "refresh-1",
      user: { id: "u1", email: "u@test.local", name: "User" },
    };
    await setSession(session);

    global.fetch = jest
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

    await expect(api("/products")).rejects.toThrow("session_timeout");
    expect(await getSession()).toBeNull();
    expect(consumeSessionTimedOut()).toBe(true);
  });
});
