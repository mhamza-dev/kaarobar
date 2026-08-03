"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useT } from "@/lib/i18n";

export type SearchSelectOption = {
  value: string;
  label: string;
  meta?: string;
};

export type SearchSelectProps = {
  options: SearchSelectOption[];
  value: string | null;
  onChange: (next: string | null) => void;
  label?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyHint?: string;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
};

export default function SearchSelect({
  options,
  value,
  onChange,
  label,
  placeholder,
  searchPlaceholder,
  emptyHint,
  disabled = false,
  clearable = true,
  className = "",
}: SearchSelectProps) {
  const t = useT();
  const resolvedPlaceholder = placeholder ?? t("searchSelect.select");
  const resolvedSearch = searchPlaceholder ?? t("searchSelect.search");
  const resolvedEmpty = emptyHint ?? t("searchSelect.noMatches");
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
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

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      {label ? (
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
          {label}
        </p>
      ) : null}
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-bg-primary px-3 py-2.5 text-start text-sm text-heading outline-none transition hover:border-brand/40 focus:border-brand/40 focus:ring-1 focus:ring-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? "" : "text-muted"}`}>
          {selected ? selected.label : resolvedPlaceholder}
        </span>
        {clearable && selected && !disabled ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear"
            className="rounded-md p-0.5 text-muted hover:bg-bg-secondary hover:text-heading"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : null}
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-card shadow-lg">
          <div className="relative border-b border-border p-2">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={resolvedSearch}
              className="w-full rounded-md border border-border bg-bg-primary py-2 pe-3 ps-8 text-sm outline-none focus:border-brand/40"
            />
          </div>
          <ul
            id={listId}
            role="listbox"
            className="max-h-56 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted">{resolvedEmpty}</li>
            ) : (
              filtered.map((opt) => {
                const on = opt.value === value;
                return (
                  <li key={opt.value} role="option" aria-selected={on}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-bg-secondary ${
                        on ? "bg-brand/10 text-heading" : "text-heading"
                      }`}
                      onClick={() => {
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <span className="min-w-0 flex-1 truncate">{opt.label}</span>
                      {opt.meta ? (
                        <span className="shrink-0 text-xs text-muted">{opt.meta}</span>
                      ) : null}
                      {on ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2.5} />
                      ) : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
