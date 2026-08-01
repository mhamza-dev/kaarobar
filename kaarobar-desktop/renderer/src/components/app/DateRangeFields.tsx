
import { fieldClass } from "@/components/app/ui";
import { useT } from "@/lib/i18n";

export type DateRangeFieldsProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
  className?: string;
};

export default function DateRangeFields({
  from,
  to,
  onFromChange,
  onToChange,
  fromLabel,
  toLabel,
  className = "",
}: DateRangeFieldsProps) {
  const t = useT();
  const fromText = fromLabel ?? t("common.from");
  const toText = toLabel ?? t("common.to");

  return (
    <div className={`grid grid-cols-2 gap-3 ${className}`}>
      <label className="min-w-0">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
          {fromText}
        </span>
        <input
          type="date"
          className={fieldClass}
          value={from}
          max={to || undefined}
          onChange={(e) => onFromChange(e.target.value)}
        />
      </label>
      <label className="min-w-0">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">
          {toText}
        </span>
        <input
          type="date"
          className={fieldClass}
          value={to}
          min={from || undefined}
          onChange={(e) => onToChange(e.target.value)}
        />
      </label>
    </div>
  );
}
