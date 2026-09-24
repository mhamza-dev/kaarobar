"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { BillingSettings } from "@/features/finance/BillingSettings";

export default function BillingSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Subscription"
        description="Your Kaarobar plan, and its invoices."
      />
      <BillingSettings />
    </>
  );
}
