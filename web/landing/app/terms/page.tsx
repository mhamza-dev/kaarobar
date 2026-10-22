import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms for using Kaarobar.",
  alternates: { canonical: "/terms" },
};

// A plain-language starting point written to match how billing actually
// behaves (trials, grace periods, cancellation at period end). Have it
// reviewed by a lawyer for your jurisdiction before launch.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" updated="22 October 2026">
      <p>
        These terms cover your use of Kaarobar&apos;s website and apps. By creating an account you agree to them on
        behalf of yourself and the organization you register. Questions:{" "}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>Keep your sign-in details safe. You&apos;re responsible for what happens under your account and for the access you give your staff.</li>
        <li>Give us accurate details, and keep them up to date.</li>
        <li>The person who registers the organization is its owner and can manage its subscription and staff.</li>
      </ul>

      <h2>Plans, trials and payment</h2>
      <ul>
        <li>Plans are billed per organization at the price shown on our <Link href="/pricing">pricing page</Link> when you subscribe.</li>
        <li>A free trial is available on an organization&apos;s first subscription. Nothing is charged during the trial.</li>
        <li>Upgrades take effect straight away and are prorated on your next invoice.</li>
        <li>If a payment fails, the service carries on for a 14-day grace period. If it&apos;s still unpaid after that, access is limited to billing, your account and exporting your records until payment is made.</li>
      </ul>

      <h2>Cancelling</h2>
      <p>
        You can cancel at any time from Settings → Subscription. Cancellation takes effect at the end of the period
        you&apos;ve paid for, and you can change your mind until then. Afterwards your records remain available to
        export.
      </p>

      <h2>Your records</h2>
      <p>
        The records you enter belong to you. You give us permission to store and process them only to provide the
        service. You&apos;re responsible for having the right to put them in Kaarobar — including your customers&apos;
        and staff&apos;s details — and for the accuracy of what you enter, such as prices and tax rates.
      </p>

      <h2>Acceptable use</h2>
      <p>
        Don&apos;t use Kaarobar for anything unlawful, try to access another organization&apos;s data, interfere
        with the service, or resell it without our agreement.
      </p>

      <h2>The service</h2>
      <p>
        We work to keep Kaarobar available and your data safe, and we&apos;ll tell you ahead of planned maintenance
        where we can. The apps need an internet connection. Features may change as the product develops; we
        won&apos;t remove something central to your plan during a period you&apos;ve paid for.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, our liability for any claim is limited to the amount you paid us in the twelve
        months before it arose, and we aren&apos;t liable for indirect losses such as lost profits.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If we change these terms in a way that matters, we&apos;ll email account owners before the change takes
        effect. Continuing to use Kaarobar after that means you accept the new terms.
      </p>
    </LegalPage>
  );
}
