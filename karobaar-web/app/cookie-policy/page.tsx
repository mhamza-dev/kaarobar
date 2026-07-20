import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Cookie Policy | Kaarobar",
  description: "How Kaarobar uses cookies and similar technologies.",
};

export default function CookiePolicyPage() {
  return (
    <section className="bg-bg-primary py-20">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-bold text-heading">Cookie Policy</h1>
        <p className="mt-4 text-body">Last updated: July 20, 2026</p>

        <div className="mt-10 space-y-8 text-body leading-8">
          <section>
            <h2 className="text-xl font-semibold text-heading">
              1. What Are Cookies
            </h2>
            <p className="mt-3">
              Cookies are small text files stored on your device to help
              websites remember preferences, keep you signed in, and understand
              how the product is used.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-heading">
              2. How We Use Cookies
            </h2>
            <p className="mt-3">
              Kaarobar uses essential cookies for authentication and security,
              preference cookies for settings, and analytics cookies to improve
              product performance and user experience.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-heading">
              3. Managing Cookies
            </h2>
            <p className="mt-3">
              You can control cookies through your browser settings. Disabling
              essential cookies may limit access to some platform features.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-heading">4. Contact</h2>
            <p className="mt-3">
              For cookie-related questions, contact{" "}
              <a
                href="mailto:support@kaarobar.com"
                className="font-medium text-brand hover:underline"
              >
                support@kaarobar.com
              </a>{" "}
              or use our{" "}
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
