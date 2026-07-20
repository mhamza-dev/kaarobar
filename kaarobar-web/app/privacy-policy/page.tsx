import type { Metadata } from "next";

import LegalDocument from "@/components/legal/LegalDocument";
import { privacySections } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Privacy Policy | Kaarobar",
  description:
    "How Kaarobar handles account, business, staff, and operational data.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="How we handle account, business, staff, and operational data when you use Kaarobar."
      sections={privacySections}
    />
  );
}
