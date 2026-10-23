"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type PageActionsState = {
  slot: HTMLElement | null;
  setSlot: (slot: HTMLElement | null) => void;
};

const PageActionsContext = createContext<PageActionsState | null>(null);

/** Mounted once by the app shell around every screen. */
export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  return (
    <PageActionsContext.Provider value={{ slot, setSlot }}>{children}</PageActionsContext.Provider>
  );
}

/**
 * The page header's action area. Holds the header's own `actions`, and
 * whatever the screen below sends up with `<PageActions>`. Hidden when it
 * holds nothing.
 */
export function PageActionsSlot({ children }: { children?: ReactNode }) {
  const context = useContext(PageActionsContext);
  return (
    <div ref={context?.setSlot} className="flex shrink-0 flex-wrap items-center gap-2 empty:hidden">
      {children}
    </div>
  );
}

/**
 * Puts a screen's primary action — "New product", "Add provider" — in the
 * page header, top right, where every screen keeps it, while its state (the
 * dialog it opens) stays in the component that owns it.
 *
 * Only for a screen's top-level component: inside a sheet or dialog it
 * would send the button behind the overlay. Outside the app shell (a unit
 * test) there's no header, so it renders in place, right-aligned.
 */
export function PageActions({ children }: { children: ReactNode }) {
  const context = useContext(PageActionsContext);
  if (!context) return <div className="mb-3 flex justify-end gap-2">{children}</div>;
  if (!context.slot) return null;
  return createPortal(children, context.slot);
}
