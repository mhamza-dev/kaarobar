"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { FollowUpsList } from "@/features/customers/FollowUps";

export default function FollowUpsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Follow-ups"
        description="Calls to make, payments to chase and deliveries to arrange."
      />
      <FollowUpsList showCustomer />
    </>
  );
}
