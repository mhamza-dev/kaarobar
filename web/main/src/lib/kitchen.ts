import type { BoardEntry } from "@/types/api/dining";

export type TicketActionKey = "start" | "ready" | "bump";

/**
 * The one button a ticket card shows, from its status.
 *
 * `Kitchen.Ticket` moves fired → preparing → ready → bumped. The board only
 * carries live tickets (fired/preparing/ready), so each has exactly one next
 * step; anything else — a bumped or cancelled ticket arriving late — gets
 * no button rather than a guess.
 */
export function nextTicketAction(
  status: string,
): { action: TicketActionKey; label: string } | null {
  switch (status) {
    case "fired":
      return { action: "start", label: "Start" };
    case "preparing":
      return { action: "ready", label: "Ready" };
    case "ready":
      return { action: "bump", label: "Bump" };
    default:
      return null;
  }
}

/**
 * Board order: priority tickets first, then the ones running latest, then
 * oldest first. A cook reads the board left to right; the order is the
 * instruction.
 */
export function sortBoard(entries: BoardEntry[]): BoardEntry[] {
  return [...entries].sort(
    (a, b) =>
      Number(b.ticket.is_priority) - Number(a.ticket.is_priority) ||
      b.minutes_late - a.minutes_late ||
      b.elapsed_minutes - a.elapsed_minutes,
  );
}
