"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { LoyaltyProgramForm } from "@/features/customers/LoyaltyProgramForm";

export default function LoyaltySettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Loyalty programme"
        description="How customers earn points, and what they're worth."
      />
      <LoyaltyProgramForm />
    </>
  );
}
