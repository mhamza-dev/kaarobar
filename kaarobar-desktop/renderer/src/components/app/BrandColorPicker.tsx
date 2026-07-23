const PRESETS = [
  "#0F766E",
  "#1D4ED8",
  "#C2410C",
  "#7C3AED",
  "#B45309",
  "#BE123C",
  "#0F172A",
  "#15803D",
] as const;

function toPickerValue(hex: string | null | undefined): string {
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex)) return hex.toUpperCase();
  if (hex && /^#[0-9A-Fa-f]{3}$/.test(hex)) {
    const h = hex.slice(1).toUpperCase();
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  return "#0F766E";
}

type Props = {
  value: string | null | undefined;
  onChange: (hex: string) => void;
};

/** Brand accent picker: native color input + hex field + presets. */
export default function BrandColorPicker({ value, onChange }: Props) {
  const pickerValue = toPickerValue(value);
  const preview = value && /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value) ? value : pickerValue;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label className="relative h-11 w-14 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border shadow-sm">
          <span
            className="absolute inset-0"
            style={{ backgroundColor: preview }}
            aria-hidden
          />
          <input
            type="color"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={pickerValue}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            aria-label="Pick brand color"
          />
        </label>
        <input
          className="min-w-0 flex-1 rounded border border-border bg-bg-secondary px-2 py-2 text-sm font-mono text-heading"
          value={value || ""}
          placeholder="#0F766E"
          spellCheck={false}
          onChange={(e) => onChange(e.target.value.trim())}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((hex) => {
          const active = (value || "").toUpperCase() === hex;
          return (
            <button
              key={hex}
              type="button"
              title={hex}
              aria-label={`Use ${hex}`}
              onClick={() => onChange(hex)}
              className={`h-7 w-7 rounded-md border transition ${
                active ? "border-heading ring-2 ring-brand/40" : "border-border hover:scale-105"
              }`}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>
      <p className="text-[11px] text-muted">Used on marketplace cards and store headers.</p>
    </div>
  );
}
