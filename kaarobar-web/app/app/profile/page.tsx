"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getSession, setSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import {
  Alert,
  Field,
  PageHeader,
  SurfaceCard,
  fieldClass,
} from "@/components/app/ui";
import { useI18n, type Locale } from "@/lib/i18n";

type ProfileUser = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  locale?: Locale;
};

export default function ProfilePage() {
  const { t, setLocale, locale } = useI18n();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    locale: "en" as Locale,
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api<{ user: ProfileUser }>("/auth/me");
      const u = res.user;
      setForm({
        name: u.name || "",
        email: u.email || "",
        phone: u.phone || "",
        locale: u.locale === "ur" ? "ur" : "en",
        password: "",
      });
      if (u.locale === "ur" || u.locale === "en") setLocale(u.locale);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("profile.loadError"));
    }
  }, [setLocale, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, string> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        locale: form.locale,
      };
      if (form.password.trim()) body.password = form.password;

      const res = await api<{ user: ProfileUser }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      const session = getSession();
      if (session) {
        setSession({
          ...session,
          user: {
            ...session.user,
            name: res.user.name,
            email: res.user.email,
            phone: res.user.phone,
            locale: res.user.locale === "ur" ? "ur" : "en",
          },
        });
      }
      setLocale(res.user.locale === "ur" ? "ur" : "en");
      setForm((f) => ({ ...f, password: "" }));
      setMessage(t("profile.saved"));
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        eyebrow={t("profile.eyebrow")}
        title={t("profile.title")}
        description={t("profile.description")}
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}

      <SurfaceCard className="p-5">
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label={t("profile.name")}>
            <input
              className={fieldClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>

          <Field label={t("profile.email")}>
            <input className={fieldClass} value={form.email} disabled />
            <p className="mt-1 text-xs text-muted">{t("profile.emailHint")}</p>
          </Field>

          <Field label={t("profile.phone")}>
            <input
              className={fieldClass}
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+92…"
            />
          </Field>

          <Field label={t("profile.locale")}>
            <select
              className={fieldClass}
              value={form.locale}
              onChange={(e) =>
                setForm({ ...form, locale: e.target.value as Locale })
              }
            >
              <option value="en">{t("common.english")}</option>
              <option value="ur">{t("common.urdu")}</option>
            </select>
            <p className="mt-1 text-xs text-muted">{t("profile.localeHint")}</p>
          </Field>

          <Field label={t("profile.newPassword")}>
            <input
              type="password"
              className={fieldClass}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
              minLength={8}
            />
            <p className="mt-1 text-xs text-muted">{t("profile.newPasswordHint")}</p>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="submit" loading={busy}>
              {t("profile.save")}
            </Button>
          </div>
        </form>
      </SurfaceCard>

      <p className="text-xs text-muted">
        {t("common.language")}: {locale === "ur" ? t("common.urdu") : t("common.english")}
      </p>
    </div>
  );
}
