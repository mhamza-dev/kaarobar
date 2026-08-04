import { formatLocalDateTime } from "@/lib/datetime";

type DateAndTimeProps = {
  value: string | Date | null | undefined;
  locale?: string;
  className?: string;
  fallback?: string;
};

export default function DateAndTime({
  value,
  locale,
  className,
  fallback = "—",
}: DateAndTimeProps) {
  const formatted = formatLocalDateTime(value, locale);
  const text = formatted === "—" ? fallback : formatted;
  const iso =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "string" && value.trim() !== ""
        ? value
        : undefined;

  return (
    <time className={className} dateTime={iso} title={formatted !== "—" ? formatted : undefined}>
      {text}
    </time>
  );
}
