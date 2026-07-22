"use client";

import { useCallback, useEffect, useState } from "react";
import { api, getSession, setSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import ProfilePicEditor from "@/components/app/ProfilePicEditor";
import {
  Field,
  PageHeader,
  SurfaceCard,
  fieldClass,
} from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useI18n, type Locale } from "@/lib/i18n";

type ProfileUser = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  locale?: Locale;
  profile_pic_url?: string | null;
};

export default function ProfilePage() {
  const { t, setLocale, locale } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    locale: "en" as Locale,
    password: "",
  });
  const [picUrl, setPicUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const syncSessionUser = useCallback((u: ProfileUser) => {
    const session = getSession();
    if (!session) return;
    setSession({
      ...session,
      user: {
        ...session.user,
        name: u.name,
        email: u.email,
        phone: u.phone,
        locale: u.locale === "ur" ? "ur" : "en",
        profile_pic_url: u.profile_pic_url ?? null,
      },
    });
  }, []);

  const load = useCallback(async () => {
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
      setPicUrl(u.profile_pic_url || null);
      syncSessionUser(u);
      if (u.locale === "ur" || u.locale === "en") setLocale(u.locale);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("profile.loadError"));
    }
  }, [setLocale, syncSessionUser, t, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
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

      syncSessionUser({ ...res.user, profile_pic_url: picUrl });
      setLocale(res.user.locale === "ur" ? "ur" : "en");
      setForm((f) => ({ ...f, password: "" }));
      toast.success(t("profile.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
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
        infoKey="page.profile"
      />

      <SurfaceCard className="p-5">
        <ProfilePicEditor
          url={picUrl}
          name={form.name}
          uploadPath="/auth/me/profile-pic"
          urlFromResponse={(body) =>
            (body as { user?: ProfileUser })?.user?.profile_pic_url
          }
          onChange={(next) => {
            setPicUrl(next);
            const session = getSession();
            if (session) {
              setSession({
                ...session,
                user: { ...session.user, profile_pic_url: next },
              });
            }
          }}
        />
      </SurfaceCard>

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
