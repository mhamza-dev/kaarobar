import { describe, expect, it } from "vitest";

import { filterRows, hasActiveFilters } from "./filtering";
import type { DataTableFilter, DataTableSearch } from "./types";

type Row = { id: string; name: string; status: string; archived: boolean };

const rows: Row[] = [
  { id: "1", name: "Flour 10kg", status: "active", archived: false },
  { id: "2", name: "Sugar 5kg", status: "draft", archived: true },
  { id: "3", name: "Salt 1kg", status: "active", archived: true },
];

const search: DataTableSearch<Row> = { getText: (row) => row.name };
const filters: DataTableFilter<Row>[] = [
  { id: "status", label: "Status", type: "select", getValue: (row) => row.status },
  { id: "archived", label: "Archived", type: "boolean", getValue: (row) => row.archived },
];

describe("filterRows", () => {
  it("returns every row when nothing is set", () => {
    expect(filterRows({ rows, query: "", search, filterState: {}, filters })).toHaveLength(3);
  });

  it("matches the search text case-insensitively", () => {
    const result = filterRows({ rows, query: "SUGAR", search, filterState: {}, filters });
    expect(result.map((row) => row.id)).toEqual(["2"]);
  });

  it("ignores surrounding whitespace in the query", () => {
    const result = filterRows({ rows, query: "  salt  ", search, filterState: {}, filters });
    expect(result.map((row) => row.id)).toEqual(["3"]);
  });

  it("treats an empty filter value as 'Any' rather than a match on empty", () => {
    const result = filterRows({ rows, query: "", search, filterState: { status: "" }, filters });
    expect(result).toHaveLength(3);
  });

  it("matches boolean filters through their stringified value", () => {
    const result = filterRows({
      rows,
      query: "",
      search,
      filterState: { archived: "true" },
      filters,
    });
    expect(result.map((row) => row.id)).toEqual(["2", "3"]);
  });

  it("ands the search and every active filter together", () => {
    const result = filterRows({
      rows,
      query: "kg",
      search,
      filterState: { status: "active", archived: "true" },
      filters,
    });
    expect(result.map((row) => row.id)).toEqual(["3"]);
  });

  it("returns nothing when the filters cannot all be satisfied", () => {
    const result = filterRows({
      rows,
      query: "flour",
      search,
      filterState: { status: "draft" },
      filters,
    });
    expect(result).toEqual([]);
  });
});

describe("hasActiveFilters", () => {
  it("is false when every filter is 'Any'", () => {
    expect(hasActiveFilters({ status: "", archived: "" })).toBe(false);
  });

  it("is true as soon as one filter is set", () => {
    expect(hasActiveFilters({ status: "", archived: "true" })).toBe(true);
  });
});
