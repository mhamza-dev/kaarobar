"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import { Check, Pipette, SlidersHorizontal } from "lucide-react";

type Preset = { hex: string; label: string };

const PRESETS: Preset[] = [
  { hex: "#0F766E", label: "Teal" },
  { hex: "#15803D", label: "Green" },
  { hex: "#1D4ED8", label: "Sapphire" },
  { hex: "#0284C7", label: "Sky" },
  { hex: "#7C3AED", label: "Violet" },
  { hex: "#BE123C", label: "Rose" },
  { hex: "#C2410C", label: "Terracotta" },
  { hex: "#B45309", label: "Amber" },
  { hex: "#0F172A", label: "Ink" },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function expandHex(hex: string): string | null {
  const h = hex.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(h)) return h.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(h)) {
    const s = h.slice(1).toUpperCase();
    return `#${s[0]}${s[0]}${s[1]}${s[1]}${s[2]}${s[2]}`;
  }
  return null;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const full = expandHex(hex);
  if (!full) return null;
  return [
    parseInt(full.slice(1, 3), 16),
    parseInt(full.slice(3, 5), 16),
    parseInt(full.slice(5, 7), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number) {
  return (
    "#" +
    [r, g, b]
      .map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) * 60;
    else if (max === G) h = ((B - R) / d + 2) * 60;
    else h = ((R - G) / d + 4) * 60;
  }
  const s = max === 0 ? 0 : d / max;
  return [h, s, max];
}

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (h < 60) [rp, gp, bp] = [c, x, 0];
  else if (h < 120) [rp, gp, bp] = [x, c, 0];
  else if (h < 180) [rp, gp, bp] = [0, c, x];
  else if (h < 240) [rp, gp, bp] = [0, x, c];
  else if (h < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];
  return [(rp + m) * 255, (gp + m) * 255, (bp + m) * 255];
}

function presetLabel(hex: string | null | undefined): string {
  const full = expandHex(hex || "") || "";
  return PRESETS.find((p) => p.hex === full)?.label || "Custom";
}

type Props = {
  value: string | null | undefined;
  onChange: (hex: string) => void;
};

/**
 * Brand color picker — presets always visible; optional custom HSV panel.
 * Avoids overflow-clipped popovers inside SurfaceCard.
 */
export default function BrandColorPicker({ value, onChange }: Props) {
  const panelId = useId();
  const satRef = useRef<HTMLDivElement>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState("");

  const current = expandHex(value || "") || "#0F766E";
  const rgb = hexToRgb(current) || [15, 118, 110];
  const [h, s, v] = rgbToHsv(rgb[0], rgb[1], rgb[2]);
  const label = presetLabel(current);
  const pureHue = rgbToHex(...hsvToRgb(h, 1, 1));
  const isCustom = !PRESETS.some((p) => p.hex === current);

  useEffect(() => {
    if (customOpen) setHexDraft(current);
  }, [customOpen, current]);

  function commitHsv(nh: number, ns: number, nv: number) {
    onChange(rgbToHex(...hsvToRgb(nh, ns, nv)));
  }

  function pickFromSat(clientX: number, clientY: number) {
    const el = satRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const ns = clamp((clientX - rect.left) / rect.width, 0, 1);
    const nv = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    commitHsv(h, ns, nv);
  }

  function onSatPointer(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pickFromSat(e.clientX, e.clientY);
  }

  function onSatMove(e: PointerEvent<HTMLDivElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    pickFromSat(e.clientX, e.clientY);
  }

  function applyHexDraft() {
    const next = expandHex(hexDraft.startsWith("#") ? hexDraft : `#${hexDraft}`);
    if (next) {
      onChange(next);
      setHexDraft(next);
    } else {
      setHexDraft(current);
    }
  }

  return (
    <div className="w-full max-w-lg space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-sm">
        <span
          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-black/10 shadow-inner"
          style={{ backgroundColor: current }}
          aria-hidden
        >
          <span className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-heading">{label}</p>
          <p className="mt-0.5 font-mono text-xs tracking-wide text-muted">{current}</p>
          <p className="mt-1 text-[11px] text-muted">
            Applies to buttons, nav, and marketplace accents.
          </p>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
          Choose a color
        </p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PRESETS.map((p) => {
            const active = current === p.hex;
            return (
              <button
                key={p.hex}
                type="button"
                onClick={() => onChange(p.hex)}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2.5 transition ${
                  active
                    ? "border-heading bg-bg-secondary ring-2 ring-offset-1 ring-offset-card"
                    : "border-border bg-card hover:border-heading/30 hover:bg-bg-secondary/70"
                }`}
                style={active ? { boxShadow: `0 0 0 2px ${p.hex}55` } : undefined}
                title={p.hex}
                aria-pressed={active}
                aria-label={p.label}
              >
                <span
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border border-black/10 shadow-sm"
                  style={{ backgroundColor: p.hex }}
                >
                  {active ? (
                    <Check
                      className="h-4 w-4 drop-shadow"
                      style={{
                        color:
                          p.hex === "#0F172A" || p.hex === "#1D4ED8" || p.hex === "#7C3AED"
                            ? "#fff"
                            : "#fff",
                      }}
                      strokeWidth={3}
                    />
                  ) : null}
                </span>
                <span className="text-[11px] font-semibold text-heading">{p.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        aria-expanded={customOpen}
        aria-controls={panelId}
        onClick={() => setCustomOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
          customOpen || isCustom
            ? "border-heading bg-bg-secondary text-heading"
            : "border-border bg-card text-body hover:bg-bg-secondary"
        }`}
      >
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Custom color
          {isCustom ? (
            <span className="rounded-md bg-card px-1.5 py-0.5 font-mono text-[10px] text-muted">
              {current}
            </span>
          ) : null}
        </span>
        <span className="text-xs font-medium text-muted">{customOpen ? "Hide" : "Open"}</span>
      </button>

      {customOpen ? (
        <div
          id={panelId}
          className="space-y-4 rounded-xl border border-border bg-card p-3 shadow-sm sm:p-4"
        >
          <div
            ref={satRef}
            className="relative h-40 w-full cursor-crosshair touch-none overflow-hidden rounded-lg border border-border"
            style={{
              backgroundColor: pureHue,
              backgroundImage: `
                linear-gradient(to top, #000000, transparent),
                linear-gradient(to right, #ffffff, rgba(255,255,255,0))
              `,
            }}
            onPointerDown={onSatPointer}
            onPointerMove={onSatMove}
          >
            <span
              className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md ring-1 ring-black/25"
              style={{
                left: `${s * 100}%`,
                top: `${(1 - v) * 100}%`,
                backgroundColor: current,
              }}
            />
          </div>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
              <Pipette className="h-3 w-3" />
              Hue
            </span>
            <input
              type="range"
              min={0}
              max={360}
              step={1}
              value={Math.round(h)}
              onChange={(e) => commitHsv(Number(e.target.value), s || 1, v || 1)}
              className="brand-hue-slider h-3.5 w-full cursor-pointer appearance-none rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
              }}
              aria-label="Hue"
            />
          </label>

          <div className="flex items-center gap-2">
            <span
              className="h-10 w-10 shrink-0 rounded-lg border border-border shadow-inner"
              style={{ backgroundColor: current }}
              aria-hidden
            />
            <label className="min-w-0 flex-1">
              <span className="sr-only">Hex color</span>
              <input
                className="w-full rounded-md border border-border bg-bg-secondary px-2.5 py-2 font-mono text-sm uppercase tracking-wide text-heading outline-none focus:border-heading focus:ring-2 focus:ring-black/5"
                value={hexDraft}
                spellCheck={false}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={applyHexDraft}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applyHexDraft();
                  }
                }}
                aria-label="Hex color code"
              />
            </label>
          </div>
        </div>
      ) : null}

      <style>{`
        .brand-hue-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          border: 2px solid #0f172a;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          cursor: pointer;
        }
        .brand-hue-slider::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #fff;
          border: 2px solid #0f172a;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
