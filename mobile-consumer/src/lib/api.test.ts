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
  logoutSession,
  setSession,
  type Session,
} from "./api";

describe("customer api unauthorized handling", () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    mockStorage.clear();
    await clearSession();
    jest.restoreAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test("clears session and marks timeout on 401", async () => {
    const session: Session = {
      actor: "consumer",
      access_token: "access-1",
      user: { id: "c1", email: "c@test.local", name: "Customer" },
    };
    await setSession(session);

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ error: "unauthorized" }),
    }) as unknown as typeof fetch;

    await expect(api("/portal/me")).rejects.toThrow("unauthorized");
    expect(await getSession()).toBeNull();
    expect(consumeSessionTimedOut()).toBe(true);
  });

  test("logoutSession calls portal logout and clears local session", async () => {
    const session: Session = {
      actor: "consumer",
      access_token: "access-1",
      user: { id: "c1", email: "c@test.local", name: "Customer" },
    };
    await setSession(session);

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "",
    }) as unknown as typeof fetch;

    await logoutSession();
    expect(await getSession()).toBeNull();
    expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain("/portal/auth/logout");
  });
});
