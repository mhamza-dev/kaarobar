"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RefundRequestsScreen } from "@/features/sales/RefundRequestsScreen";

export default function RefundRequestsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Sell"
        title="Refund requests"
        description="Refunds cashiers have asked for, waiting on approval."
      />
      <RefundRequestsScreen />
    </>
  );
}
