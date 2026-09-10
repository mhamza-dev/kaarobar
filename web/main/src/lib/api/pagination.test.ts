import { describe, expect, it } from "vitest";

import { flattenPages, getNextCursorParam } from "./pagination";
import type { Paginated } from "@/types/api/common";

function page(data: number[], hasMore: boolean, nextCursor: string | null): Paginated<number> {
  return { data, meta: { limit: 2, has_more: hasMore, next_cursor: nextCursor } };
}

describe("getNextCursorParam", () => {
  it("returns the cursor while more pages remain", () => {
    expect(getNextCursorParam(page([1, 2], true, "cursor-2"))).toBe("cursor-2");
  });

  it("returns undefined on the last page, so React Query stops", () => {
    expect(getNextCursorParam(page([3], false, null))).toBeUndefined();
  });

  it("returns undefined when the backend claims more but sends no cursor", () => {
    // Defensive: has_more without next_cursor would otherwise loop forever
    // refetching page one.
    expect(getNextCursorParam(page([1, 2], true, null))).toBeUndefined();
  });
});

describe("flattenPages", () => {
  it("concatenates every page's rows in order", () => {
    expect(flattenPages([page([1, 2], true, "c"), page([3], false, null)])).toEqual([1, 2, 3]);
  });

  it("is empty-safe before the first page lands", () => {
    expect(flattenPages(undefined)).toEqual([]);
  });
});
