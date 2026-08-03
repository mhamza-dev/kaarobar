import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getSession, setSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import ProfilePicEditor from "@/components/app/ProfilePicEditor";
import LanguageSwitcher from "@/components/app/LanguageSwitcher";
import { Field, SurfaceCard, fieldClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n";
import { settingsKeys } from "@/lib/queryClient";

type ProfileUser = {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  profile_pic_url?: string | null;
};

export default function ProfileSettingsPanel() {
  const { t } = useI18n();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
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
        profile_pic_url: u.profile_pic_url ?? null,
      },
    });
  }, []);

  const { data: profile, isError, error } = useQuery({
    queryKey: settingsKeys.profile(),
    queryFn: async () => {
      const res = await api<{ user: ProfileUser }>("/auth/me");
      return res.user;
    },
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name || "",
      email: profile.email || "",
      phone: profile.phone || "",
      password: "",
    });
    setPicUrl(profile.profile_pic_url || null);
    syncSessionUser(profile);
  }, [profile, syncSessionUser]);

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : t("profile.loadError"));
    }
  }, [isError, error, t, toast]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body: Record<string, string> = {
        name: form.name.trim(),
        phone: form.phone.trim(),
      };
      if (form.password.trim()) body.password = form.password;

      const res = await api<{ user: ProfileUser }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      syncSessionUser({ ...res.user, profile_pic_url: picUrl });
      queryClient.setQueryData(settingsKeys.profile(), {
        ...res.user,
        profile_pic_url: picUrl,
      });
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
            queryClient.setQueryData(
              settingsKeys.profile(),
              (prev: ProfileUser | undefined) =>
                prev ? { ...prev, profile_pic_url: next } : prev
            );
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

          <Field label={t("common.language")}>
            <LanguageSwitcher className="mt-1" />
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
    </div>
  );
}
