import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, getSession, setSession } from "@/lib/api/client";
import Button from "@/components/ui/Button";
import CustomForm from "@/components/ui/CustomForm";
import { FormikTextField } from "@/components/ui/FormFields";
import ProfilePicEditor from "@/components/app/ProfilePicEditor";
import LanguageSwitcher from "@/components/app/LanguageSwitcher";
import { Field, SurfaceCard, fieldClass, formStackClass } from "@/components/app/ui";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n";
import { settingsKeys } from "@/lib/queryClient";
import {
  emptyProfileForm,
  profileFormSchema,
  type ProfileFormValues,
} from "@/lib/validations/profile";

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
  const [initialValues, setInitialValues] = useState<ProfileFormValues>(
    emptyProfileForm()
  );
  const [email, setEmail] = useState("");
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
    setInitialValues({
      name: profile.name || "",
      phone: profile.phone || "",
      password: "",
    });
    setEmail(profile.email || "");
    setPicUrl(profile.profile_pic_url || null);
    syncSessionUser(profile);
  }, [profile, syncSessionUser]);

  useEffect(() => {
    if (isError) {
      toast.error(error instanceof Error ? error.message : t("profile.loadError"));
    }
  }, [isError, error, t, toast]);

  async function onSubmit(values: ProfileFormValues) {
    setBusy(true);
    try {
      const body: Record<string, string> = {
        name: values.name.trim(),
        phone: values.phone.trim(),
      };
      if (values.password.trim()) body.password = values.password;

      const res = await api<{ user: ProfileUser }>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });

      syncSessionUser({ ...res.user, profile_pic_url: picUrl });
      queryClient.setQueryData(settingsKeys.profile(), {
        ...res.user,
        profile_pic_url: picUrl,
      });
      setInitialValues({
        name: res.user.name || "",
        phone: res.user.phone || "",
        password: "",
      });
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
          name={initialValues.name}
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
        <CustomForm
          initialValues={initialValues}
          validationSchema={profileFormSchema}
          onSubmit={onSubmit}
          className={formStackClass}
        >
          {() => (
            <>
              <FormikTextField name="name" label={t("profile.name")} required />

              <Field label={t("profile.email")}>
                <input className={fieldClass} value={email} disabled />
                <p className="mt-1 text-xs text-muted">{t("profile.emailHint")}</p>
              </Field>

              <FormikTextField
                name="phone"
                label={t("profile.phone")}
                placeholder="+92…"
              />

              <Field label={t("common.language")}>
                <LanguageSwitcher compact />
              </Field>

              <FormikTextField
                name="password"
                label={t("profile.newPassword")}
                type="password"
                autoComplete="new-password"
                hint={t("profile.newPasswordHint")}
              />

              <div className="flex justify-end gap-2 pt-2">
                <Button type="submit" loading={busy}>
                  {t("profile.save")}
                </Button>
              </div>
            </>
          )}
        </CustomForm>
      </SurfaceCard>
    </div>
  );
}
