"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Lock,
  Mail,
  Phone,
  User,
} from "lucide-react";

import CustomForm from "@/components/ui/CustomForm";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import OptionSelector from "@/components/ui/OptionSelector";
import TermsModal from "@/components/modals/TermsModal";
import PrivacyPolicyModal from "@/components/modals/PrivacyPolicyModal";
import { authMethodOptions } from "@/components/auth/auth-method-options";
import { signupSchema } from "@/lib/validations/auth";
import {
  api,
  hydrateSessionContext,
  setSession,
  type AuthActor,
  type StoredSession,
} from "@/lib/api/client";
import { useI18n, type Locale } from "@/lib/i18n";
import * as Yup from "yup";

interface SignupFormValues {
  signupMethod: "email" | "phone";
  fullName: string;
  businessName: string;
  email: string;
  phoneNumber: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

type SignupFormProps = {
  actor: AuthActor;
};

const buyerSignupSchema = Yup.object({
  signupMethod: Yup.string().oneOf(["email", "phone"]).required(),
  fullName: Yup.string().required("Full name is required"),
  businessName: Yup.string().optional(),
  email: Yup.string().when("signupMethod", {
    is: "email",
    then: (s) => s.email("Invalid email").required("Email is required"),
    otherwise: (s) => s.optional(),
  }),
  phoneNumber: Yup.string().optional(),
  password: Yup.string().min(8, "Min 8 characters").required("Password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords must match")
    .required("Confirm password"),
  acceptTerms: Yup.boolean().oneOf([true], "Accept terms to continue"),
});

const SignupForm = ({ actor }: SignupFormProps): React.ReactElement => {
  const router = useRouter();
  const { setLocale } = useI18n();
  const [termsModal, setTermsModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const isBuyer = actor === "consumer";

  const initialValues: SignupFormValues = {
    signupMethod: "email",
    fullName: "",
    businessName: "",
    email: "",
    phoneNumber: "",
    password: "",
    confirmPassword: "",
    acceptTerms: false,
  };

  const handleSubmit = async (values: SignupFormValues): Promise<void> => {
    setFormError(null);
    try {
      if (values.signupMethod !== "email") {
        setFormError("Phone signup will be available soon. Please use email.");
        return;
      }

      if (isBuyer) {
        const result = await api<{
          access_token: string;
          account: NonNullable<StoredSession["account"]>;
          memberships?: StoredSession["buyer_memberships"];
        }>(
          "/auth/register",
          {
            method: "POST",
            body: JSON.stringify({
              actor: "consumer",
              email: values.email,
              password: values.password,
              name: values.fullName,
              phone: values.phoneNumber || null,
            }),
          },
          null
        );
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
        };
        setSession(session);
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
        "/auth/register",
        {
          method: "POST",
          body: JSON.stringify({
            actor: "business",
            email: values.email,
            password: values.password,
            name: values.fullName,
            phone: values.phoneNumber || null,
            business_name: values.businessName,
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
      setFormError(error instanceof Error ? error.message : "Signup failed");
    }
  };

  return (
    <>
      <CustomForm
        initialValues={initialValues}
        validationSchema={isBuyer ? buyerSignupSchema : signupSchema}
        onSubmit={handleSubmit}
      >
        {({ values, setFieldValue, isSubmitting }) => (
          <div className="space-y-1">
            {formError ? (
              <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {formError}
              </p>
            ) : null}
            {!isBuyer ? (
              <OptionSelector
                label="Sign up with"
                value={values.signupMethod}
                onChange={(value) => {
                  setFieldValue("signupMethod", value);

                  if (value === "email") {
                    setFieldValue("phoneNumber", "");
                  } else {
                    setFieldValue("email", "");
                  }
                }}
                options={authMethodOptions}
              />
            ) : null}

            {values.signupMethod === "email" || isBuyer ? (
              <Input
                type="email"
                name="email"
                label="Email Address"
                placeholder={isBuyer ? "you@email.com" : "you@company.com"}
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

            <div className={`grid grid-cols-1 gap-x-4 ${isBuyer ? "" : "md:grid-cols-2"}`}>
              <Input
                type="text"
                name="fullName"
                label="Full Name"
                placeholder="Your full name"
                leftIcon={<User size={18} />}
                required
              />

              {!isBuyer ? (
                <Input
                  type="text"
                  name="businessName"
                  label="Business Name"
                  placeholder="Your business name"
                  leftIcon={<Building2 size={18} />}
                  required
                />
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <Input
                type="password"
                name="password"
                label="Password"
                placeholder="Create a password"
                leftIcon={<Lock size={18} />}
                required
              />

              <Input
                type="password"
                name="confirmPassword"
                label="Confirm Password"
                placeholder="Confirm password"
                leftIcon={<Lock size={18} />}
                required
              />
            </div>

            <div className="mb-6">
              <Input
                type="checkbox"
                name="acceptTerms"
                required
                label={
                  <>
                    I agree to the{" "}
                    <Button
                      variant="link"
                      onClick={(event) => {
                        event.preventDefault();
                        setTermsModal(true);
                      }}
                      className="font-medium text-brand hover:underline"
                    >
                      Terms & Conditions
                    </Button>{" "}
                    and{" "}
                    <Button
                      variant="link"
                      onClick={(event) => {
                        event.preventDefault();
                        setPrivacyModal(true);
                      }}
                      className="font-medium text-brand hover:underline"
                    >
                      Privacy Policy
                    </Button>
                  </>
                }
              />
            </div>

            <Button
              type="submit"
              fullWidth
              size="lg"
              loading={isSubmitting}
              endIcon={<ArrowRight size={18} />}
            >
              {isBuyer ? "Create consumer account" : "Create Account"}
            </Button>
          </div>
        )}
      </CustomForm>

      <TermsModal isOpen={termsModal} onClose={() => setTermsModal(false)} />
      <PrivacyPolicyModal
        isOpen={privacyModal}
        onClose={() => setPrivacyModal(false)}
      />
    </>
  );
};

export default SignupForm;
