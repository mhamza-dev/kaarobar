import { describe, expect, it } from "vitest";

import { filenameFromDisposition } from "./download";

describe("filenameFromDisposition", () => {
  it("reads the quoted filename the backend sends", () => {
    expect(
      filenameFromDisposition('attachment; filename="daily_2026-09-01_2026-09-24.csv"', "x.csv"),
    ).toBe("daily_2026-09-01_2026-09-24.csv");
  });

  it("prefers the RFC 5987 encoded form when present", () => {
    expect(
      filenameFromDisposition(
        `attachment; filename="a.csv"; filename*=UTF-8''sales%20report.csv`,
        "x.csv",
      ),
    ).toBe("sales report.csv");
  });

  it("falls back when there is no header", () => {
    expect(filenameFromDisposition(null, "report.csv")).toBe("report.csv");
  });
});
