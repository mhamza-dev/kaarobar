import type { Metadata } from "next";

import LegalDocument from "@/components/legal/LegalDocument";
import { termsSections } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Terms & Conditions | Kaarobar",
  description:
    "Terms for using Kaarobar’s web app, desktop POS, and mobile apps.",
};

export default function TermsOfServicePage() {
  return (
    <LegalDocument
      title="Terms & Conditions"
      description="The ground rules for using Kaarobar’s web app, desktop POS, and mobile apps."
      sections={termsSections}
    />
  );
}
