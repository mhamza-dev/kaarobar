import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Kaarobar",
  description: "Terms and conditions for using the Kaarobar platform.",
};

export default function TermsOfServicePage() {
  return (
    <section className="bg-bg-primary py-20">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-bold text-heading">
          Terms of Service
        </h1>
        <p className="mt-4 text-body">Last updated: July 20, 2026</p>

        <div className="mt-10 space-y-8 text-body leading-8">
          <section>
            <h2 className="text-xl font-semibold text-heading">
              1. Acceptance of Terms
            </h2>
            <p className="mt-3">
              By creating an account or using Kaarobar, you agree to these Terms
              of Service. If you do not agree, you must stop using the platform.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-heading">
              2. Account Responsibilities
            </h2>
            <p className="mt-3">
              You are responsible for maintaining the confidentiality of your
              login credentials and for all activity that occurs under your
              account. Provide accurate business information and keep it
              updated.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-heading">
              3. Acceptable Use
            </h2>
            <p className="mt-3">
              You agree not to misuse Kaarobar, attempt unauthorized access,
              disrupt service availability, or use the platform for unlawful
              activities.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-heading">4. Contact</h2>
            <p className="mt-3">
              For questions about these terms, reach us at{" "}
              <a
                href="mailto:support@kaarobar.com"
                className="font-medium text-brand hover:underline"
              >
                support@kaarobar.com
              </a>{" "}
              or visit our{" "}
              <Link href="/contact" className="font-medium text-brand hover:underline">
                contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}
