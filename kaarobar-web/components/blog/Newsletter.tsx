"use client";

import { Mail, ArrowRight, ShieldCheck } from "lucide-react";
import type { FormikHelpers } from "formik";
import * as yup from "yup";

import Button from "@/components/ui/Button";
import CustomForm from "@/components/ui/CustomForm";
import Input from "@/components/ui/Input";

interface NewsletterFormValues {
  email: string;
}

const newsletterSchema = yup.object({
  email: yup
    .string()
    .trim()
    .email("Please enter a valid email address")
    .required("Email address is required"),
});

export default function Newsletter() {
  const initialValues: NewsletterFormValues = {
    email: "",
  };

  const handleSubmit = async (
    values: NewsletterFormValues,
    { resetForm, setSubmitting }: FormikHelpers<NewsletterFormValues>,
  ) => {
    console.log(values);
    resetForm();
    setSubmitting(false);
  };

  return (
    <section className="relative overflow-hidden bg-bg-secondary py-28">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#2563eb15,transparent_70%)]" />

      <div className="relative mx-auto max-w-5xl px-6">
        <div className="overflow-hidden rounded-4xl border border-border bg-card shadow-xl">
          <div className="grid items-center gap-12 p-10 lg:grid-cols-2 lg:p-16">
            <div>
              <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
                Newsletter
              </span>

              <h2 className="mt-6 text-4xl font-bold leading-tight text-heading">
                Occasional notes
                <br />
                from the team
              </h2>

              <p className="mt-6 text-lg leading-8 text-body">
                Product updates, how we think about multi-branch retail, and
                practical tips for owners—no fluff lists, no spam.
              </p>

              <div className="mt-8 flex items-center gap-3 text-body">
                <ShieldCheck size={20} className="text-success" />
                <span>No spam. Unsubscribe anytime.</span>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-bg-primary p-8">
              <h3 className="text-2xl font-bold text-heading">
                Get email updates
              </h3>

              <p className="mt-2 text-body">
                New posts and product changes—only when there’s something worth saying.
              </p>

              <CustomForm
                initialValues={initialValues}
                validationSchema={newsletterSchema}
                onSubmit={handleSubmit}
                className="mt-8 space-y-5"
              >
                {({ isSubmitting }) => (
                  <>
                    <Input
                      type="email"
                      name="email"
                      placeholder="Enter your email address"
                      leftIcon={<Mail size={18} />}
                    />

                    <Button
                      type="submit"
                      fullWidth
                      size="lg"
                      loading={isSubmitting}
                      endIcon={<ArrowRight size={18} />}
                    >
                      Subscribe
                    </Button>
                  </>
                )}
              </CustomForm>

              <p className="mt-6 text-center text-sm text-muted">
                By subscribing, you agree to receive emails from Kaarobar. You
                can unsubscribe at any time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
