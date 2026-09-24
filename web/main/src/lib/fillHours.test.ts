import { describe, expect, it } from "vitest";

import { fillHours } from "./reportPeriod";

describe("fillHours", () => {
  it("fills the quiet hours between the first and last sale with zeros", () => {
    const filled = fillHours([
      { hour: 16, sale_count: 3, net_sales: "5560.00" },
      { hour: 18, sale_count: 6, net_sales: "6800.00" },
    ]);

    expect(filled.map((row) => row.hour)).toEqual([16, 17, 18]);
    expect(filled[1]).toEqual({ hour: 17, sale_count: 0, net_sales: "0.00" });
  });

  it("returns nothing for a period with no sales", () => {
    expect(fillHours([])).toEqual([]);
  });
});
