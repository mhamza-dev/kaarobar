import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Lock, Mail, Phone } from "lucide-react";

import CustomForm from "@/components/ui/CustomForm";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import OptionSelector from "@/components/ui/OptionSelector";
import { authMethodOptions } from "@/components/auth/auth-method-options";
import { loginSchema } from "@/lib/validations/auth";
import { api, hydrateSessionContext, setSession } from "@/lib/api/client";
import { useI18n, type Locale } from "@/lib/i18n";
import { useToast } from "@/components/ui/Toast";

interface LoginFormValues {
  loginMethod: "email" | "phone";
  email: string;
  phoneNumber: string;
  password: string;
  remember: boolean;
}

const LoginForm = (): React.ReactElement => {
  const navigate = useNavigate();
  const { t, setLocale } = useI18n();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);

  const initialValues: LoginFormValues = {
    loginMethod: "email",
    email: "",
    phoneNumber: "",
    password: "",
    remember: false,
  };

  const handleSubmit = async (values: LoginFormValues): Promise<void> => {
    setFormError(null);
    try {
      if (values.loginMethod !== "email") {
        setFormError("Phone login will be available soon. Please use email.");
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
      }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          actor: "business",
          email: values.email,
          password: values.password,
          remember_me: Boolean(values.remember),
        }),
      }, null);

      const base = {
        actor: "business" as const,
        access_token: result.access_token,
        user: result.user,
      };
      setSession(base);
      if (result.user.locale === "ur" || result.user.locale === "en") {
        setLocale(result.user.locale);
      }
      const hydrated = await hydrateSessionContext(base);
      setSession(hydrated);
      navigate("/app");
    } catch (error) {
      const msg = error instanceof Error ? error.message : t("auth.loginFailed");
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
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

          {values.loginMethod === "email" ? (
            <Input
              type="email"
              name="email"
              label="Email Address"
              placeholder="you@company.com"
              leftIcon={<Mail size={18} />}
              required
            />
          ) : (
            <Input
              type="tel"
              name="phoneNumber"
              label="Phone Number"
              placeholder="+92 300 1234567"
              leftIcon={<Phone size={18} />}
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

          <div className="mb-6 flex items-center justify-between gap-4">
            <div className="[&>div]:mb-0">
              <Input type="checkbox" name="remember" label="Remember me" />
            </div>

            <Link href="/forgot-password" variant="link" className="shrink-0 text-sm">
              Forgot password?
            </Link>
          </div>

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
  );
};

export default LoginForm;
