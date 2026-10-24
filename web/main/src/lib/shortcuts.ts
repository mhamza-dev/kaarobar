import { getVisibleNavGroups } from "@/lib/nav";
import type { Scope } from "@/types/api/me";

/**
 * "g" then a letter jumps to a screen, as in Gmail or Linear. Kept to the
 * screens a shop visits all day; everything else is a ⌘K away.
 */
const GO_TO: Array<{ key: string; href: string }> = [
  { key: "d", href: "/dashboard" },
  { key: "t", href: "/pos" },
  { key: "s", href: "/sales" },
  { key: "p", href: "/products" },
  { key: "c", href: "/customers" },
  { key: "i", href: "/stock" },
  { key: "r", href: "/reports" },
  { key: "e", href: "/expenses" },
];

export type GoToShortcut = { key: string; href: string; label: string };

/**
 * The jumps this person can actually make — only screens the sidebar shows
 * them, so a shortcut never lands on a 403 or a module the business lacks.
 */
export function goToShortcuts(scope: Scope | null): GoToShortcut[] {
  const visible = new Map(
    getVisibleNavGroups(scope)
      .flatMap((group) => group.items)
      .map((item) => [item.href, item.label]),
  );
  return GO_TO.flatMap((shortcut) => {
    const label = visible.get(shortcut.href);
    return label ? [{ ...shortcut, label }] : [];
  });
}

/**
 * Whether a key press belongs to whatever has focus rather than to the app:
 * typing a "g" into a search box must not navigate anywhere.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;
  const type = (target as HTMLInputElement).type;
  return !["checkbox", "radio", "button", "submit", "reset", "range", "color"].includes(type);
}
