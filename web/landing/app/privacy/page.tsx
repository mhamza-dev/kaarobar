import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "What Kaarobar collects, why, and the choices you have.",
  alternates: { canonical: "/privacy" },
};

// A plain-language starting point written to match how the product works
// today. Have it reviewed by a lawyer for your jurisdiction before launch.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" updated="22 October 2026">
      <p>
        This policy explains what information Kaarobar collects when you use our website and apps, why we
        collect it, and the choices you have. If anything here is unclear, email{" "}
        <a href={`mailto:${site.contactEmail}`}>{site.contactEmail}</a>.
      </p>

      <h2>Two kinds of data</h2>
      <p>
        <strong>Your account data</strong> is information about you and your organization — your name, email,
        business details and subscription. We are responsible for it.
      </p>
      <p>
        <strong>Your business records</strong> are what you put into Kaarobar to run your business — products,
        sales, stock, your customers and suppliers, and your staff. You own these records and decide what goes
        in them; we store and process them only to provide the service to you.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account details you give us: name, email address, phone number, password (stored only as a one-way hash) and business details.</li>
        <li>Records you enter while using Kaarobar.</li>
        <li>Security information: sign-in times, device names, IP addresses and an audit log of sensitive actions, so you can see who did what and sign out devices you don&apos;t recognise.</li>
        <li>Billing details: your plan and invoices. Card payments are handled by Stripe; card numbers never reach our servers.</li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To provide, secure and support the service.</li>
        <li>To send the emails the service needs — confirming your address, resetting your password, invitations, invoices and payment reminders.</li>
        <li>To meet legal obligations, such as tax reporting you have switched on.</li>
      </ul>
      <p>We don&apos;t sell your data, and we don&apos;t use your business records for advertising.</p>

      <h2>Who we share it with</h2>
      <p>
        Only the service providers we need to run Kaarobar — hosting, email delivery and payment processing — and
        only for that purpose; tax authorities, when you have enabled reporting to them; and anyone the law
        requires us to.
      </p>

      <h2>How we protect it</h2>
      <p>
        Each organization&apos;s records are isolated from every other&apos;s, including at the database level.
        Sensitive values such as payment-gateway credentials are encrypted, access within your organization is
        controlled by roles you set, and two-step sign-in is available on every account.
      </p>

      <h2>Your choices</h2>
      <ul>
        <li>Export your records at any time from the app, including after your subscription ends.</li>
        <li>Correct your account details from your profile.</li>
        <li>Ask us to delete your account. Some records may need to be kept for a period where the law requires it, such as invoices.</li>
      </ul>

      <h2>Cookies</h2>
      <p>
        This website doesn&apos;t use tracking or advertising cookies. The Kaarobar app uses a single cookie to
        keep you signed in.
      </p>

      <h2>Changes</h2>
      <p>
        If we change this policy in a way that matters, we&apos;ll tell account owners by email before the change
        takes effect.
      </p>
    </LegalPage>
  );
}
