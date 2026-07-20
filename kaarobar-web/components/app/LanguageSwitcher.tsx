"use client";

import { useI18n, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();

  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      {!compact ? (
        <span className="text-xs font-medium text-muted">{t("common.language")}</span>
      ) : null}
      <select
        className="rounded-md border border-border bg-card px-2 py-1.5 text-xs font-semibold text-heading outline-none focus:border-brand"
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t("common.language")}
      >
        <option value="en">{t("common.english")}</option>
        <option value="ur">{t("common.urdu")}</option>
      </select>
    </label>
  );
}
