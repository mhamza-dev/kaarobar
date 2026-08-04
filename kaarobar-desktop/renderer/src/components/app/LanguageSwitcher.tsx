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
  /** Hide the language label (use when a parent Field already provides one). */
  compact?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {!compact ? (
        <span className="block text-sm font-medium text-heading">{t("common.language")}</span>
      ) : null}
      <Select
        size="md"
        className="w-full"
        value={locale}
        onChange={(v) => setLocale(v as Locale)}
        aria-label={t("common.language")}
        options={LOCALES.map((code) => ({
          value: code,
          label: LOCALE_NATIVE_LABELS[code],
        }))}
        triggerClassName="w-full border-border bg-bg-secondary/80 text-sm font-medium hover:border-brand/40 focus:border-brand/20"
      />
    </div>
  );
}
