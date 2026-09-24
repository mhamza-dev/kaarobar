"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { PaymentProviders } from "@/features/finance/PaymentProviders";

export default function PaymentProvidersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Payment providers"
        description="The gateways the till can charge cards and wallets through."
      />
      <PaymentProviders />
    </>
  );
}
