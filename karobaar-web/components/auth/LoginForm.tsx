"use client";

import React from "react";
import { ArrowRight, Lock, Mail, Phone } from "lucide-react";

import CustomForm from "@/components/ui/CustomForm";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Link from "@/components/ui/Link";
import OptionSelector from "@/components/ui/OptionSelector";
import { authMethodOptions } from "@/components/auth/auth-method-options";
import { loginSchema } from "@/lib/validations/auth";

interface LoginFormValues {
  loginMethod: "email" | "phone";
  email: string;
  phoneNumber: string;
  password: string;
  remember: boolean;
}

const LoginForm = (): React.ReactElement => {
  const initialValues: LoginFormValues = {
    loginMethod: "email",
    email: "",
    phoneNumber: "",
    password: "",
    remember: false,
  };

  const handleSubmit = async (values: LoginFormValues): Promise<void> => {
    try {
      console.log(values);
    } catch (error) {
      console.error(error);
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
