"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import type { SearchSelectOption } from "@/components/ui/SearchSelect";
import { useT } from "@/lib/i18n";

export type SearchMultiSelectProps = {
  options: SearchSelectOption[];
  value: string[];
  onChange: (next: string[]) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyHint?: string;
  disabled?: boolean;
  className?: string;
};

export default function SearchMultiSelect({
  options,
  value,
  onChange,
  label,
  placeholder,
  searchPlaceholder,
  emptyHint,
  disabled = false,
  className = "",
}: SearchMultiSelectProps) {
  type Coords = { top: number; left: number; width: number; openUp: boolean };
  const t = useT();
  const resolvedPlaceholder = placeholder ?? t("searchSelect.select");
  const resolvedSearch = searchPlaceholder ?? t("searchSelect.search");
  const resolvedEmpty = emptyHint ?? t("searchSelect.noMatches");
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const selectedOpts = useMemo(
    () => options.filter((o) => value.includes(o.value)),
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.meta && o.meta.toLowerCase().includes(q)) ||
        o.value.toLowerCase().includes(q)
    );
  }, [options, query]);

  function updatePosition() {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const estimatedHeight = 320;
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
  }, [open, filtered.length, value.length]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function toggle(optionValue: string) {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label ? (
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
          {label}
        </p>
      ) : null}

      {selectedOpts.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedOpts.map((opt) => (
            <span
              key={opt.value}
              className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-1 text-xs font-semibold text-heading"
            >
              {opt.label}
              {!disabled ? (
                <button
                  type="button"
                  aria-label={`Remove ${opt.label}`}
                  className="rounded-md p-0.5 text-muted hover:bg-brand/20 hover:text-heading"
                  onClick={() => toggle(opt.value)}
                >
                  <X className="h-3 w-3" />
                </button>
              ) : null}
            </span>
          ))}
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-bg-primary px-3 py-2.5 text-start text-sm text-heading outline-none transition hover:border-brand/40 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={`min-w-0 flex-1 truncate ${value.length ? "" : "text-muted"}`}>
          {value.length
            ? t("searchSelect.selected", { count: value.length })
            : resolvedPlaceholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open && coords && mounted
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-[220] overflow-hidden rounded-md border border-border bg-card shadow-lg"
              style={{
                top: coords.top,
                left: coords.left,
                width: coords.width,
                transform: coords.openUp ? "translateY(-100%)" : undefined,
              }}
            >
              <div className="relative border-b border-border p-2">
                <Search className="pointer-events-none absolute start-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={resolvedSearch}
                  className="w-full rounded-md border border-border bg-bg-primary py-2 pe-3 ps-8 text-sm outline-none"
                />
              </div>
              <ul
                id={listId}
                role="listbox"
                aria-multiselectable
                className="max-h-56 overflow-y-auto py-1"
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted">{resolvedEmpty}</li>
                ) : (
                  filtered.map((opt) => {
                    const on = value.includes(opt.value);
                    return (
                      <li key={opt.value} role="option" aria-selected={on}>
                        <button
                          type="button"
                          className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-bg-secondary ${
                            on ? "bg-brand/10 text-heading" : "text-heading"
                          }`}
                          onClick={() => toggle(opt.value)}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border ${
                              on
                                ? "border-brand bg-brand text-brand-foreground"
                                : "border-border bg-card"
                            }`}
                          >
                            {on ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
                          </span>
                          <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                          {opt.meta ? (
                            <span className="shrink-0 text-xs text-muted">{opt.meta}</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
