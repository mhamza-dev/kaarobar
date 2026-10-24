"use client";

import { Keyboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsApple } from "@/hooks/useIsApple";
import { goToShortcuts, isTypingTarget } from "@/lib/shortcuts";
import { useSessionStore } from "@/stores/sessionStore";

/** How long after "g" the second key still counts as part of the jump. */
const SEQUENCE_MS = 1200;

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border bg-muted px-1.5 font-sans text-xs font-medium text-foreground shadow-[inset_0_-1px_0_var(--border)]">
      {children}
    </kbd>
  );
}

function Row({ keys, label }: { keys: ReactNode[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 text-sm">
      <span className="text-foreground/85">{label}</span>
      <span className="flex shrink-0 items-center gap-1">
        {keys.map((key, index) => (
          <Key key={index}>{key}</Key>
        ))}
      </span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="divide-y divide-border/70">{children}</div>
    </section>
  );
}

/**
 * The keyboard map, opened with "?" from anywhere outside a text field, and
 * the "g then a letter" jumps it documents. A counter is run from the
 * keyboard as much as the mouse, so the shortcuts are listed where people
 * can find them rather than left as folklore.
 */
export function ShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const scope = useSessionStore((state) => state.scope);
  const apple = useIsApple();
  const shortcuts = goToShortcuts(scope);
  const pendingG = useRef<number | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      // "?" is Shift+/ on most layouts; some report the "/" with Shift held.
      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      const now = Date.now();
      if (pendingG.current && now - pendingG.current < SEQUENCE_MS) {
        pendingG.current = null;
        const target = shortcuts.find((shortcut) => shortcut.key === event.key.toLowerCase());
        if (target) {
          event.preventDefault();
          setOpen(false);
          router.push(target.href);
        }
        return;
      }

      if (event.key.toLowerCase() === "g" && !event.shiftKey) pendingG.current = now;
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router, shortcuts]);

  const mod = apple ? "⌘" : "Ctrl";

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(true)}
              aria-label="Keyboard shortcuts"
              aria-keyshortcuts="Shift+?"
              className="text-muted-foreground hover:text-foreground max-md:hidden"
            />
          }
        >
          <Keyboard className="size-[1.125rem]" />
        </TooltipTrigger>
        <TooltipContent side="bottom">Keyboard shortcuts</TooltipContent>
      </Tooltip>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              They work anywhere outside a text box. Press <Key>?</Key> to bring this back.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <Section title="Everywhere">
              <Row keys={[mod, "K"]} label="Search or jump to a screen" />
              <Row keys={["?"]} label="Show these shortcuts" />
              <Row keys={["Esc"]} label="Close a dialog or panel" />
            </Section>

            {shortcuts.length > 0 && (
              <Section title="Go to">
                {shortcuts.map((shortcut) => (
                  <Row
                    key={shortcut.href}
                    keys={["G", shortcut.key.toUpperCase()]}
                    label={shortcut.label}
                  />
                ))}
              </Section>
            )}

            <Section title="At the till">
              <Row keys={["/"]} label="Jump to the scan box" />
              <Row keys={["Enter"]} label="Look up a barcode, or add the first match" />
              <Row keys={["Esc"]} label="Clear the scan box" />
              <Row keys={[mod, "Enter"]} label="Complete the sale once it's paid" />
            </Section>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
