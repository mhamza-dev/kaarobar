"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal } from "lucide-react";

export type ActionMenuItem = {
  id: string;
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  tone?: "default" | "danger";
  disabled?: boolean;
  hidden?: boolean;
};

type Props = {
  items: ActionMenuItem[];
  /** Accessible name for the trigger */
  label?: string;
  align?: "start" | "end";
  className?: string;
};

type MenuCoords = { top: number; left: number; minWidth: number };

export default function ActionMenu({
  items,
  label = "Actions",
  align = "end",
  className = "",
}: Props) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<MenuCoords | null>(null);
  const [mounted, setMounted] = useState(false);

  const visible = items.filter((i) => !i.hidden);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const menuWidth = Math.max(180, rect.width);
    const left =
      align === "end"
        ? Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 8)
        : Math.max(8, rect.left);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 220 && rect.top > spaceBelow;
    setCoords({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(8, left),
      minWidth: menuWidth,
    });
  }, [align]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (visible.length === 0) return null;

  const menu =
    open && coords && mounted
      ? createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            className="fixed z-[90] overflow-hidden rounded-xl border border-border bg-card py-1 shadow-lg shadow-black/10 ring-1 ring-black/5"
            style={{
              top: coords.top,
              left: coords.left,
              minWidth: coords.minWidth,
              transform:
                coords.top < (triggerRef.current?.getBoundingClientRect().bottom ?? 0)
                  ? "translateY(-100%)"
                  : undefined,
            }}
          >
            {visible.map((item) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  item.tone === "danger"
                    ? "text-danger hover:bg-danger/10"
                    : "text-heading hover:bg-bg-tertiary"
                }`}
                onClick={() => {
                  if (item.disabled) return;
                  setOpen(false);
                  item.onClick();
                }}
              >
                {item.icon ? (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center opacity-70">
                    {item.icon}
                  </span>
                ) : null}
                <span className="font-medium">{item.label}</span>
              </button>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      className={`inline-flex ${className}`}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-body transition hover:border-brand/40 hover:bg-bg-tertiary hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 ${
          open ? "border-brand bg-brand-light text-brand" : ""
        }`}
      >
        <MoreHorizontal className="h-4 w-4" strokeWidth={2.25} />
      </button>
      {menu}
    </div>
  );
}
