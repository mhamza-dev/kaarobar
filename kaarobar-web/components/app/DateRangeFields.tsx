"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type DateRangeFieldsProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
};

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  next.setDate(next.getDate() + n);
  return next;
}

function startOfWeekMon(d: Date): Date {
  const day = (d.getDay() + 6) % 7;
  return addDays(d, -day);
}

function formatShort(iso: string, locale: string): string {
  const d = parseISO(iso);
  if (!d) return "";
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).format(d);
}

function monthTitle(view: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(view);
}

function buildMonthCells(view: Date) {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = addDays(first, -startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return {
      iso: toISO(date),
      day: date.getDate(),
      inMonth: date.getMonth() === view.getMonth(),
    };
  });
}

function presetRange(
  key: "today" | "yesterday" | "lastWeek" | "lastMonth" | "lastQuarter"
): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (key === "today") {
    const iso = toISO(today);
    return { from: iso, to: iso };
  }
  if (key === "yesterday") {
    const iso = toISO(addDays(today, -1));
    return { from: iso, to: iso };
  }
  if (key === "lastWeek") {
    const thisMon = startOfWeekMon(today);
    const lastMon = addDays(thisMon, -7);
    const lastSun = addDays(thisMon, -1);
    return { from: toISO(lastMon), to: toISO(lastSun) };
  }
  if (key === "lastMonth") {
    const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const last = new Date(today.getFullYear(), today.getMonth(), 0);
    return { from: toISO(first), to: toISO(last) };
  }
  const q = Math.floor(today.getMonth() / 3);
  const prevQ = q === 0 ? 3 : q - 1;
  const year = q === 0 ? today.getFullYear() - 1 : today.getFullYear();
  const first = new Date(year, prevQ * 3, 1);
  const last = new Date(year, prevQ * 3 + 3, 0);
  return { from: toISO(first), to: toISO(last) };
}

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"] as const;

type PanelCoords = { top: number; left: number; width: number; openUp: boolean };

export default function DateRangeFields({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel,
  className = "",
}: DateRangeFieldsProps) {
  const { t, locale } = useI18n();
  const panelId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [view, setView] = useState(() => {
    const seed = parseISO(from) ?? parseISO(to) ?? new Date();
    return new Date(seed.getFullYear(), seed.getMonth(), 1);
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelWidth = Math.min(Math.max(rect.width, 360), window.innerWidth - 16);
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - panelWidth - 8
    );
    const estimatedHeight = 320;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;
    setCoords({
      top: openUp ? rect.top - 6 : rect.bottom + 6,
      left,
      width: panelWidth,
      openUp,
    });
  }, []);

  useEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    const seed = parseISO(from) ?? parseISO(to) ?? new Date();
    setView(new Date(seed.getFullYear(), seed.getMonth(), 1));
    setAnchor(null);
    updatePosition();
    const onScroll = () => updatePosition();
    const onResize = () => updatePosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // Sync calendar month only when the popover opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- from/to read at open time
  }, [open, updatePosition]);

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

  const cells = useMemo(() => buildMonthCells(view), [view]);

  const display = useMemo(() => {
    if (!from && !to) return t("dateRange.placeholder");
    if (from && to && from !== to) {
      return `${formatShort(from, locale)} – ${formatShort(to, locale)}`;
    }
    const single = from || to;
    return formatShort(single, locale);
  }, [from, to, locale, t]);

  function applyRange(nextFrom: string, nextTo: string) {
    onFromChange(nextFrom);
    onToChange(nextTo);
  }

  function onDayClick(iso: string) {
    if (!anchor) {
      setAnchor(iso);
      applyRange(iso, iso);
      return;
    }
    if (iso < anchor) applyRange(iso, anchor);
    else applyRange(anchor, iso);
    setAnchor(null);
  }

  function applyPreset(
    key: "today" | "yesterday" | "lastWeek" | "lastMonth" | "lastQuarter"
  ) {
    const range = presetRange(key);
    applyRange(range.from, range.to);
    setAnchor(null);
    const seed = parseISO(range.from) ?? new Date();
    setView(new Date(seed.getFullYear(), seed.getMonth(), 1));
  }

  function reset() {
    applyRange("", "");
    setAnchor(null);
  }

  const rangeStart = from && to ? (from <= to ? from : to) : from || to || "";
  const rangeEnd = from && to ? (from <= to ? to : from) : from || to || "";

  const presets = [
    { key: "today" as const, label: t("dateRange.today") },
    { key: "yesterday" as const, label: t("dateRange.yesterday") },
    { key: "lastWeek" as const, label: t("dateRange.lastWeek") },
    { key: "lastMonth" as const, label: t("dateRange.lastMonth") },
    { key: "lastQuarter" as const, label: t("dateRange.lastQuarter") },
  ];

  const panel =
    open && coords && mounted
      ? createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={t("dateRange.placeholder")}
            className="fixed z-[110] flex overflow-hidden rounded-xl border border-border bg-bg-elevated shadow-lg shadow-black/10"
            style={{
              top: coords.top,
              left: coords.left,
              width: coords.width,
              transform: coords.openUp ? "translateY(-100%)" : undefined,
            }}
          >
            <aside className="flex w-[7.5rem] shrink-0 flex-col border-r border-border bg-bg-secondary/60 py-3">
              <div className="flex flex-1 flex-col gap-0.5 px-2">
                {presets.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyPreset(p.key)}
                    className="rounded-md px-2.5 py-1.5 text-left text-sm text-body hover:bg-brand-soft hover:text-brand"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={reset}
                className="mt-2 px-4 py-1.5 text-left text-sm font-medium text-brand hover:underline"
              >
                {t("dateRange.reset")}
              </button>
            </aside>

            <div className="min-w-0 flex-1 px-3 pb-3 pt-2.5">
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  aria-label={t("dateRange.prevMonth")}
                  className="rounded-md p-1.5 text-muted hover:bg-bg-hover hover:text-heading"
                  onClick={() =>
                    setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))
                  }
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold text-heading">
                  {monthTitle(view, locale)}
                </p>
                <button
                  type="button"
                  aria-label={t("dateRange.nextMonth")}
                  className="rounded-md p-1.5 text-muted hover:bg-bg-hover hover:text-heading"
                  onClick={() =>
                    setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))
                  }
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-1 grid grid-cols-7 gap-y-1 text-center text-[11px] font-medium text-muted">
                {WEEKDAYS.map((d) => (
                  <span key={d} className="py-1">
                    {d}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-1">
                {cells.map((cell) => {
                  const selected =
                    !!rangeStart &&
                    !!rangeEnd &&
                    cell.iso >= rangeStart &&
                    cell.iso <= rangeEnd;
                  const isStart = cell.iso === rangeStart;
                  const isEnd = cell.iso === rangeEnd;
                  const isEdge = isStart || isEnd;
                  const inRange = selected && !isEdge && rangeStart !== rangeEnd;

                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      onClick={() => onDayClick(cell.iso)}
                      className={`relative flex h-8 items-center justify-center text-sm ${
                        inRange ? "bg-brand-soft" : ""
                      } ${
                        selected && rangeStart !== rangeEnd && isStart
                          ? "rounded-l-full bg-brand-soft"
                          : ""
                      } ${
                        selected && rangeStart !== rangeEnd && isEnd
                          ? "rounded-r-full bg-brand-soft"
                          : ""
                      }`}
                    >
                      <span
                        className={`relative z-[1] flex h-8 w-8 items-center justify-center rounded-full ${
                          isEdge
                            ? "bg-brand font-semibold text-brand-foreground"
                            : cell.inMonth
                              ? "text-heading hover:bg-bg-hover"
                              : "text-muted/50 hover:bg-bg-hover"
                        }`}
                      >
                        {cell.day}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className={`relative min-w-0 ${className}`}>
      {fromLabel ? (
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
          {fromLabel}
        </span>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border bg-bg-primary px-3 py-2.5 text-left text-sm transition-colors ${
          open
            ? "border-brand text-heading shadow-[0_0_0_1px_var(--brand)]"
            : "border-border text-heading hover:border-brand/50"
        }`}
      >
        <span className={from || to ? "text-heading" : "text-muted"}>{display}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {panel}
    </div>
  );
}
