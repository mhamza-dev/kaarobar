"use client";

import { CornerDownLeft, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useIsApple } from "@/hooks/useIsApple";
import { createActions } from "@/lib/createActions";
import { getVisibleNavGroups } from "@/lib/nav";
import { useSessionStore } from "@/stores/sessionStore";

/**
 * Every typed word must start a word of the item — its label, its route or
 * its group. cmdk's default fuzzy match is too loose for this list: "sto"
 * would find cu*sto*mers before Stock. Items whose label starts with the
 * first word rank first.
 */
function matchScore(value: string, search: string, keywords?: string[]) {
  const terms = search.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  const words = [value, ...(keywords ?? [])]
    .join(" ")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

  let score = 0;
  for (const term of terms) {
    const index = words.findIndex((word) => word.startsWith(term));
    if (index === -1) return 0;
    score += index === 0 ? 2 : 1;
  }
  return score / (terms.length * 2);
}

/**
 * "Search or jump to…" — every screen the sidebar offers, reachable by
 * typing a few letters, from the header or with ⌘K / Ctrl+K anywhere.
 *
 * Built from the same `getVisibleNavGroups(scope)` as the sidebar, so it
 * lists exactly what this person may open in this business and nothing the
 * sidebar would hide. The trigger is a button, not a text box: the screen's
 * own search fields stay the only "Search" text boxes on the page.
 */
export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const scope = useSessionStore((state) => state.scope);
  const { resolvedTheme, setTheme } = useTheme();
  const groups = getVisibleNavGroups(scope);
  const creates = createActions(scope);
  const dark = resolvedTheme === "dark";
  const apple = useIsApple();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function run(action: () => void) {
    setOpen(false);
    action();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts="Meta+K Control+K"
        className="flex size-9 shrink-0 items-center justify-center gap-2 rounded-lg border border-input bg-background text-sm text-muted-foreground shadow-xs transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:w-full md:max-w-sm md:justify-start md:px-3"
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="flex-1 text-left max-md:sr-only">Search or jump to…</span>
        <kbd className="pointer-events-none hidden h-5 items-center rounded border border-border bg-muted px-1.5 font-sans text-[0.688rem] font-medium text-muted-foreground md:inline-flex">
          {apple ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 shadow-lift sm:max-w-xl"
        >
          <DialogTitle className="sr-only">Search or jump to</DialogTitle>
          <Command loop filter={matchScore} className="rounded-none! p-0">
            <div className="border-b border-border p-2">
              <CommandInput placeholder="Type a screen or action…" />
            </div>
            <CommandList className="max-h-[min(60vh,26rem)] p-1">
              <CommandEmpty>Nothing matches that.</CommandEmpty>
              {creates.length > 0 && (
                <CommandGroup heading="Create">
                  {creates.map((action) => (
                    <CommandItem
                      key={action.href}
                      value={`${action.label} ${action.href}`}
                      keywords={action.keywords}
                      onSelect={() => run(() => router.push(action.href))}
                      className="gap-3 py-2"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md bg-accent text-accent-foreground">
                        <action.icon className="size-4" />
                      </span>
                      {action.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {groups.map((group) => (
                <CommandGroup key={group.label || "general"} heading={group.label || "General"}>
                  {group.items.map((item) => (
                    <CommandItem
                      key={item.href}
                      // The route keeps the value unique, and lets "pos" find the till.
                      value={`${item.label} ${item.href}`}
                      keywords={group.label ? [group.label] : undefined}
                      onSelect={() => run(() => router.push(item.href))}
                      className="gap-3 py-2"
                    >
                      <span className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                        <item.icon className="size-4" />
                      </span>
                      {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
              <CommandSeparator className="my-1" />
              <CommandGroup heading="Preferences">
                <CommandItem
                  value={dark ? "Switch to light mode" : "Switch to dark mode"}
                  keywords={["theme", "appearance", "dark", "light", "night"]}
                  onSelect={() => run(() => setTheme(dark ? "light" : "dark"))}
                  className="gap-3 py-2"
                >
                  <span className="flex size-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
                    {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                  </span>
                  {dark ? "Switch to light mode" : "Switch to dark mode"}
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="hidden items-center gap-4 border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground sm:flex">
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-background px-1 font-sans">↑</kbd>
              <kbd className="rounded border border-border bg-background px-1 font-sans">↓</kbd>
              to move
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="flex h-4.5 items-center rounded border border-border bg-background px-1">
                <CornerDownLeft className="size-3" aria-hidden />
              </kbd>
              to open
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="rounded border border-border bg-background px-1 font-sans">esc</kbd>
              to close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
