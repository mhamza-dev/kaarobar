"use client";

import {
  useI18n,
  LOCALES,
  LOCALE_NATIVE_LABELS,
  type Locale,
} from "@/lib/i18n";
import Select from "@/components/ui/Select";

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
        <span className="text-xs font-medium text-rail-muted">{t("common.language")}</span>
      ) : null}
      <Select
        size="sm"
        className="w-auto"
        value={locale}
        onChange={(v) => setLocale(v as Locale)}
        aria-label={t("common.language")}
        options={LOCALES.map((code) => ({
          value: code,
          label: LOCALE_NATIVE_LABELS[code],
        }))}
        triggerClassName="border-rail-border bg-card font-semibold hover:bg-rail-hover focus:border-brand"
      />
    </label>
  );
}
