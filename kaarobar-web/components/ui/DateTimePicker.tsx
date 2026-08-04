"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type DateTimePickerMode = "date" | "datetime";

export type DateTimePickerProps = {
  value: string;
  onChange: (next: string) => void;
  mode?: DateTimePickerMode;
  label?: ReactNode;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  /** Optional error message shown under the field */
  error?: string;
};

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseDatePart(value: string): Date | null {
  const datePart = (value || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseTimePart(value: string): { h: string; m: string } {
  const match = value.match(/T(\d{2}):(\d{2})/);
  if (!match) return { h: "00", m: "00" };
  return { h: match[1], m: match[2] };
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + n);
  return next;
}

function buildMonthCells(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = addDays(first, -startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return {
      iso: toISODate(date),
      day: date.getDate(),
      inMonth: date.getMonth() === view.getMonth(),
    };
  });
}

/**
 * Theme-aware date / datetime picker for forms.
 * Value formats: `YYYY-MM-DD` (date) or `YYYY-MM-DDTHH:mm` (datetime).
 */
export default function DateTimePicker({
  value,
  onChange,
  mode = "date",
  label,
  placeholder,
  disabled = false,
  required = false,
  name,
  id,
  className = "",
  error,
}: DateTimePickerProps) {
  const { locale, t } = useI18n();
  const listId = useId();
  const fieldId = id ?? name ?? listId;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const selected = parseDatePart(value);
  const [view, setView] = useState(() => selected || new Date());
  const time = parseTimePart(value);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (selected) setView(selected);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => buildMonthCells(view), [view]);
  const monthLabel = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(view);

  const display = useMemo(() => {
    if (!selected) return "";
    const dateLabel = new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(selected);
    if (mode === "date") return dateLabel;
    return `${dateLabel} · ${time.h}:${time.m}`;
  }, [selected, locale, mode, time.h, time.m]);

  function pickDate(iso: string) {
    if (mode === "date") {
      onChange(iso);
      setOpen(false);
      return;
    }
    onChange(`${iso}T${time.h}:${time.m}`);
  }

  function setHour(h: string) {
    const date = (value || toISODate(new Date())).slice(0, 10);
    const hh = h.padStart(2, "0").slice(0, 2);
    onChange(`${date}T${hh}:${time.m}`);
  }

  function setMinute(m: string) {
    const date = (value || toISODate(new Date())).slice(0, 10);
    const mm = m.padStart(2, "0").slice(0, 2);
    onChange(`${date}T${time.h}:${mm}`);
  }

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
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

  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openUp: boolean;
  } | null>(null);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const openUp = window.innerHeight - rect.bottom < 320 && rect.top > 320;
    setCoords({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 320)),
      width: Math.max(rect.width, 280),
      openUp,
    });
  }, [open]);

  const panel =
    open && coords && mounted
      ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[220] overflow-hidden rounded-md border border-border bg-card/95 p-3 shadow-lg backdrop-blur-md"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.openUp ? "translateY(-100%)" : undefined,
            }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-md p-1.5 text-muted hover:bg-bg-secondary hover:text-heading"
                onClick={() =>
                  setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))
                }
                aria-label="Previous month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold text-heading">{monthLabel}</p>
              <button
                type="button"
                className="rounded-md p-1.5 text-muted hover:bg-bg-secondary hover:text-heading"
                onClick={() =>
                  setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))
                }
                aria-label="Next month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold uppercase text-muted">
              {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((cell) => {
                const on = value.slice(0, 10) === cell.iso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => pickDate(cell.iso)}
                    className={`rounded-md py-1.5 text-sm transition ${
                      on
                        ? "bg-brand text-brand-foreground"
                        : cell.inMonth
                          ? "text-heading hover:bg-bg-secondary"
                          : "text-muted/60 hover:bg-bg-secondary"
                    }`}
                  >
                    {cell.day}
                  </button>
                );
              })}
            </div>
            {mode === "datetime" ? (
              <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                <Clock className="h-4 w-4 text-muted" />
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={time.h}
                  onChange={(e) => setHour(e.target.value)}
                  className="w-14 rounded-md border border-border bg-bg-secondary/80 px-2 py-1.5 text-center text-sm text-heading"
                  aria-label="Hour"
                />
                <span className="text-muted">:</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={time.m}
                  onChange={(e) => setMinute(e.target.value)}
                  className="w-14 rounded-md border border-border bg-bg-secondary/80 px-2 py-1.5 text-center text-sm text-heading"
                  aria-label="Minute"
                />
              </div>
            ) : null}
            <div className="mt-2 flex justify-between gap-2">
              <button
                type="button"
                className="text-xs font-semibold text-muted hover:text-heading"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="text-xs font-semibold text-brand"
                onClick={() => {
                  const today = toISODate(new Date());
                  if (mode === "date") onChange(today);
                  else {
                    const now = new Date();
                    const hh = String(now.getHours()).padStart(2, "0");
                    const mm = String(now.getMinutes()).padStart(2, "0");
                    onChange(`${today}T${hh}:${mm}`);
                  }
                  setOpen(false);
                }}
              >
                Today
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`min-w-0 ${className}`}>
      {label ? (
        <label htmlFor={fieldId} className="mb-1.5 block text-sm font-medium text-heading">
          {label}
          {required ? <span className="text-danger"> *</span> : null}
        </label>
      ) : null}
      {name ? (
        <input type="hidden" name={name} value={value} required={required && !value} readOnly />
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        id={fieldId}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="box-border flex h-[2.625rem] min-h-[2.625rem] w-full items-center gap-2 rounded-md border border-border bg-bg-secondary/80 px-3 text-start text-sm leading-none text-heading outline-none transition hover:border-brand/40 focus:border-brand/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted" />
        <span className={`min-w-0 flex-1 truncate ${display ? "" : "text-muted"}`}>
          {display || placeholder || (mode === "datetime" ? "Select date & time" : "Select date")}
        </span>
      </button>
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      {panel}
    </div>
  );
}
