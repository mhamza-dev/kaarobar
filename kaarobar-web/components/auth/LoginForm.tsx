"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Lock, Mail, Phone } from "lucide-react";

import CustomForm from "@/components/ui/CustomForm";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import OptionSelector from "@/components/ui/OptionSelector";
import { authMethodOptions } from "@/components/auth/auth-method-options";
import { loginSchema } from "@/lib/validations/auth";
import {
  api,
  hydrateSessionContext,
  setSession,
  type AuthActor,
  type StoredSession,
} from "@/lib/api/client";
import { useI18n, type Locale } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";

interface LoginFormValues {
  loginMethod: "email" | "phone";
  email: string;
  phoneNumber: string;
  password: string;
  remember: boolean;
}

type LoginFormProps = {
  actor: AuthActor;
  onActorChange: (actor: AuthActor) => void;
};

const LoginForm = ({ actor, onActorChange }: LoginFormProps): React.ReactElement => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, setLocale } = useI18n();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitePassword, setInvitePassword] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);

  useEffect(() => {
    const invite = searchParams.get("invite");
    const as = searchParams.get("as");
    if (as === "consumer") onActorChange("consumer");
    if (invite) {
      setInviteToken(invite);
      onActorChange("consumer");
    }
  }, [searchParams, onActorChange]);

  const initialValues: LoginFormValues = {
    loginMethod: "email",
    email: "",
    phoneNumber: "",
    password: "",
    remember: false,
  };

  const persistBuyerSession = (result: {
    access_token: string;
    account: NonNullable<StoredSession["account"]>;
    memberships?: StoredSession["buyer_memberships"];
  }) => {
    const session: StoredSession = {
      actor: "consumer",
      access_token: result.access_token,
      account: result.account,
      buyer_memberships: result.memberships || [],
      user: {
        id: result.account.id,
        email: result.account.email,
        name: result.account.name || result.account.email,
        phone: result.account.phone,
      },
      business_id: result.memberships?.[0]?.business_id,
    };
    setSession(session);
    return session;
  };

  async function acceptInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteToken) return;
    setInviteBusy(true);
    setFormError(null);
    try {
      const result = await api<{
        access_token: string;
        account: NonNullable<StoredSession["account"]>;
        memberships?: StoredSession["buyer_memberships"];
      }>(
        "/auth/buyer/accept-invite",
        {
          method: "POST",
          body: JSON.stringify({ token: inviteToken, password: invitePassword }),
        },
        null
      );
      persistBuyerSession(result);
      toast.success("Welcome — you're signed in as a consumer");
      router.push("/app");
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("auth.loginFailed");
      setFormError(msg);
      toast.error(msg);
    } finally {
      setInviteBusy(false);
    }
  }

  const handleSubmit = async (values: LoginFormValues): Promise<void> => {
    setFormError(null);
    try {
      if (values.loginMethod !== "email") {
        setFormError("Phone login will be available soon. Please use email.");
        return;
      }

      if (actor === "consumer") {
        const result = await api<{
          actor: string;
          access_token: string;
          account: NonNullable<StoredSession["account"]>;
          memberships?: StoredSession["buyer_memberships"];
        }>(
          "/auth/login",
          {
            method: "POST",
            body: JSON.stringify({
              actor: "consumer",
              email: values.email,
              password: values.password,
            }),
          },
          null
        );
        const session = persistBuyerSession(result);
        await hydrateSessionContext(session);
        router.push("/app");
        return;
      }

      const result = await api<{
        access_token: string;
        user: {
          id: string;
          email: string;
          name: string;
          phone?: string | null;
          locale?: Locale;
        };
      }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({
            actor: "business",
            email: values.email,
            password: values.password,
            remember_me: Boolean(values.remember),
          }),
        },
        null
      );

      const base: StoredSession = {
        actor: "business",
        access_token: result.access_token,
        user: result.user,
      };
      setSession(base);
      if (result.user.locale === "ur" || result.user.locale === "en") {
        setLocale(result.user.locale);
      }
      const hydrated = await hydrateSessionContext(base);
      setSession(hydrated);
      router.push("/app");
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("auth.loginFailed");
      setFormError(msg);
      toast.error(msg);
    }
  };

  if (inviteToken && actor === "consumer") {
    return (
      <form onSubmit={acceptInvite} className="space-y-4">
        {formError ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </p>
        ) : null}
        <p className="text-sm text-body">
          Set a password to join Kaarobar as a buyer and shop across listed stores.
        </p>
        <label className="block text-sm font-medium text-heading">
          New password
          <input
            type="password"
            required
            minLength={8}
            className="mt-1 w-full rounded-md border border-border px-3 py-2"
            value={invitePassword}
            onChange={(e) => setInvitePassword(e.target.value)}
          />
        </label>
        <Button type="submit" fullWidth size="lg" loading={inviteBusy}>
          Accept invite &amp; sign in
        </Button>
        <button
          type="button"
          className="w-full text-sm text-brand hover:underline"
          onClick={() => setInviteToken(null)}
        >
          Already have a password? Sign in instead
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-border p-1">
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
            actor === "business"
              ? "bg-brand text-brand-foreground"
              : "text-body hover:bg-bg-hover"
          }`}
          onClick={() => onActorChange("business")}
        >
          Business
        </button>
        <button
          type="button"
          className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition ${
            actor === "consumer"
              ? "bg-brand text-brand-foreground"
              : "text-body hover:bg-bg-hover"
          }`}
          onClick={() => onActorChange("consumer")}
        >
          Sign in as Consumer
        </button>
      </div>

      <CustomForm
        initialValues={initialValues}
        validationSchema={loginSchema}
        onSubmit={handleSubmit}
      >
        {({ values, setFieldValue, isSubmitting }) => (
          <div className="space-y-1">
            {formError ? (
              <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}

            {actor === "business" ? (
              <OptionSelector
                label="Sign in with"
                value={values.loginMethod}
                onChange={(value) => {
                  setFieldValue("loginMethod", value);
                  if (value === "email") {
                    setFieldValue("phoneNumber", "");
                  } else {
                    setFieldValue("email", "");
                  }
                }}
                options={authMethodOptions}
              />
            ) : null}

            {actor === "business" && values.loginMethod === "phone" ? (
              <Input
                type="tel"
                name="phoneNumber"
                label="Phone Number"
                placeholder="+92 300 1234567"
                leftIcon={<Phone size={18} />}
                required
              />
            ) : (
              <Input
                type="email"
                name="email"
                label="Email Address"
                placeholder={
                  actor === "consumer" ? "you@email.com" : "you@company.com"
                }
                leftIcon={<Mail size={18} />}
                required
              />
            )}

            <Input
              type="password"
              name="password"
              label="Password"
              placeholder="Enter your password"
              leftIcon={<Lock size={18} />}
              required
            />

            {actor === "business" ? (
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="[&>div]:mb-0">
                  <Input type="checkbox" name="remember" label="Remember me" />
                </div>
                <Link href="/forgot-password" variant="link" className="shrink-0 text-sm">
                  Forgot password?
                </Link>
              </div>
            ) : (
              <div className="mb-6" />
            )}

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isSubmitting}
              endIcon={<ArrowRight size={18} />}
            >
              Sign In
            </Button>
          </div>
        )}
      </CustomForm>
    </div>
  );
};

export default LoginForm;
