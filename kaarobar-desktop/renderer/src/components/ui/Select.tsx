"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";

export type SelectOption = {
  value: string;
  label: string;
};

export type SelectProps = {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "md";
  id?: string;
  name?: string;
  title?: string;
  "aria-label"?: string;
  required?: boolean;
};

type Coords = { top: number; left: number; width: number; openUp: boolean };

export default function Select({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  className = "",
  triggerClassName = "",
  size = "md",
  id,
  name,
  title,
  "aria-label": ariaLabel,
  required = false,
}: SelectProps) {
  const t = useT();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);

  const resolvedPlaceholder = placeholder ?? t("searchSelect.select");
  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  function updatePosition() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimatedHeight = Math.min(224, options.length * 36 + 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    setCoords({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)),
      width: rect.width,
      openUp,
    });
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
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

  const sizeClass =
    size === "sm"
      ? "rounded-md border px-2 py-1 text-xs"
      : "rounded-md border px-3 py-2.5 text-sm";

  const panel =
    open && coords && mounted
      ? createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            className="fixed z-[120] max-h-56 overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg shadow-black/10"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.openUp ? "translateY(-100%)" : undefined,
            }}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-sm text-muted">{t("searchSelect.noMatches")}</div>
            ) : (
              options.map((opt) => {
                const on = opt.value === value;
                return (
                  <button
                    key={opt.value || "__empty"}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm transition hover:bg-bg-secondary ${
                      on ? "bg-brand/10 text-heading" : "text-heading"
                    }`}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                    {on ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2.5} />
                    ) : null}
                  </button>
                );
              })
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative min-w-0 ${className}`}>
      {name ? (
        <input
          type="hidden"
          name={name}
          value={value}
          required={required && !value}
          readOnly
          tabIndex={-1}
          aria-hidden
        />
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 border-border bg-bg-primary text-start text-heading outline-none transition hover:border-brand/40 focus:border-brand/40 disabled:cursor-not-allowed disabled:opacity-60 ${sizeClass} ${triggerClassName}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-muted"}`}>
          {selected ? selected.label : resolvedPlaceholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {panel}
    </div>
  );
}
