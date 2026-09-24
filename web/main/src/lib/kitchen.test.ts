import { describe, expect, it } from "vitest";

import type { BoardEntry } from "@/types/api/dining";

import { nextTicketAction, sortBoard } from "./kitchen";

function entry(id: string, overrides: Partial<BoardEntry> & { priority?: boolean } = {}) {
  return {
    ticket: { id, status: "fired", is_priority: overrides.priority ?? false },
    station: null,
    elapsed_minutes: 0,
    minutes_late: 0,
    late: false,
    ...overrides,
  } as BoardEntry;
}

describe("nextTicketAction", () => {
  it("walks fired → start → ready → bump", () => {
    expect(nextTicketAction("fired")?.action).toBe("start");
    expect(nextTicketAction("preparing")?.action).toBe("ready");
    expect(nextTicketAction("ready")?.action).toBe("bump");
  });

  it("offers nothing for a ticket that has left the board", () => {
    expect(nextTicketAction("bumped")).toBeNull();
    expect(nextTicketAction("cancelled")).toBeNull();
  });
});

describe("sortBoard", () => {
  it("puts priority first, then the latest, then the oldest", () => {
    const sorted = sortBoard([
      entry("old", { elapsed_minutes: 20 }),
      entry("late", { elapsed_minutes: 5, minutes_late: 3 }),
      entry("vip", { priority: true, elapsed_minutes: 1 }),
      entry("new", { elapsed_minutes: 2 }),
    ]);

    expect(sorted.map((e) => e.ticket.id)).toEqual(["vip", "late", "old", "new"]);
  });
});
