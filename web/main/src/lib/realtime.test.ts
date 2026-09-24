import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({ env: { apiUrl: "http://localhost:4000/api/v1" } }));

import { socketUrlFor } from "./realtime";

describe("socketUrlFor", () => {
  it("swaps the API path for /socket on the same host", () => {
    expect(socketUrlFor("http://localhost:4000/api/v1")).toBe("ws://localhost:4000/socket");
  });

  it("uses wss for an https API", () => {
    expect(socketUrlFor("https://api.kaarobar.pk/api/v1/")).toBe("wss://api.kaarobar.pk/socket");
  });
});
