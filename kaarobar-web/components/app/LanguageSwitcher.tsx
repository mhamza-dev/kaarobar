"use client";

import { api, getSession, setSession } from "@/lib/api/client";
import { useI18n, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher({
  className = "",
  compact = false,
  persistToProfile = false,
}: {
  className?: string;
  compact?: boolean;
  persistToProfile?: boolean;
}) {
  const { locale, setLocale, t } = useI18n();

  function onChange(next: Locale) {
    setLocale(next);
    if (!persistToProfile) return;
    void api<{ user?: { locale?: string } }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify({ locale: next }),
    })
      .then((res) => {
        const current = getSession();
        if (current && res.user) {
          setSession({
            ...current,
            user: {
              ...current.user,
              locale: res.user.locale === "ur" ? "ur" : "en",
            },
          });
        }
      })
      .catch(() => {
        /* local switch still applies */
      });
  }

  return (
    <label className={`inline-flex items-center gap-2 ${className}`}>
      {!compact ? (
        <span className="text-xs font-medium text-rail-muted">{t("common.language")}</span>
      ) : null}
      <select
        className="rounded-md border border-rail-border bg-card px-2 py-1.5 text-xs font-semibold text-heading outline-none transition hover:bg-rail-hover focus:border-brand"
        value={locale}
        onChange={(e) => onChange(e.target.value as Locale)}
        aria-label={t("common.language")}
      >
        <option value="en">{t("common.english")}</option>
        <option value="ur">{t("common.urdu")}</option>
      </select>
    </label>
  );
}
