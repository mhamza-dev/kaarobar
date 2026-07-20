import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Kaarobar",
  description: "How Kaarobar collects, uses, and protects your information.",
};

export default function PrivacyPolicyPage() {
  return (
    <section className="bg-bg-primary py-20">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-bold text-heading">Privacy Policy</h1>
        <p className="mt-4 text-body">Last updated: July 20, 2026</p>

        <div className="mt-10 space-y-8 text-body leading-8">
          <section>
            <h2 className="text-xl font-semibold text-heading">1. Overview</h2>
            <p className="mt-3">
              Kaarobar collects account, business, and usage information to
              provide and improve our Business Operating System. We only use
              data needed to deliver core product features and support.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-heading">
              2. Information We Collect
            </h2>
            <p className="mt-3">
              We may collect your name, email, phone number, business details,
              billing information, and product usage analytics when you create
              an account or interact with Kaarobar services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-heading">
              3. How We Use Information
            </h2>
            <p className="mt-3">
              Information is used to operate the platform, authenticate users,
              process transactions, provide customer support, improve product
              quality, and send important service communications.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-heading">4. Contact</h2>
            <p className="mt-3">
              Questions about privacy can be sent to{" "}
              <a
                href="mailto:support@kaarobar.com"
                className="font-medium text-brand hover:underline"
              >
                support@kaarobar.com
              </a>{" "}
              or through our{" "}
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
