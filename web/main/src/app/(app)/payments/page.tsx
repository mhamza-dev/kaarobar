"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { GatewayPayments } from "@/features/finance/GatewayPayments";

export default function PaymentsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Sell"
        title="Card & wallet payments"
        description="Money taken through a payment gateway, and the payouts that follow."
      />
      <GatewayPayments />
    </>
  );
}
