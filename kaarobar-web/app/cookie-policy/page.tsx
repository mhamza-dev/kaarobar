import type { Metadata } from "next";

import LegalDocument from "@/components/legal/LegalDocument";
import { cookieSections } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Cookie Policy | Kaarobar",
  description:
    "How Kaarobar uses cookies and local storage on web and desktop POS.",
};

export default function CookiePolicyPage() {
  return (
    <LegalDocument
      title="Cookie Policy"
      description="How we use cookies, browser storage, and local POS data to keep you signed in and the till working."
      sections={cookieSections}
    />
  );
}
