"use client";

import React, { useState } from "react";
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

const SignupForm = (): React.ReactElement => {
  const [termsModal, setTermsModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);

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
    try {
      console.log(values);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <CustomForm
        initialValues={initialValues}
        validationSchema={signupSchema}
        onSubmit={handleSubmit}
      >
        {({ values, setFieldValue, isSubmitting }) => (
          <div className="space-y-1">
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

            {values.signupMethod === "email" ? (
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

            <div className="grid grid-cols-1 gap-x-4 md:grid-cols-2">
              <Input
                type="text"
                name="fullName"
                label="Full Name"
                placeholder="Your full name"
                leftIcon={<User size={18} />}
                required
              />

              <Input
                type="text"
                name="businessName"
                label="Business Name"
                placeholder="Your business name"
                leftIcon={<Building2 size={18} />}
                required
              />
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
              Create Account
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
