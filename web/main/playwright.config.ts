import { defineConfig, devices } from "@playwright/test";

/**
 * The critical-path e2e suite. Runs against a real, running backend (not
 * mocked) — `cd backend && mix phx.server` plus `npm run dev` here — because
 * what these tests are for is proving the two actually agree on the wire
 * format. Component-level behaviour is covered by the Vitest suite instead.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
