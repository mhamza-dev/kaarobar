"use client";

import { Suspense } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { BillingSettings } from "@/features/finance/BillingSettings";

export default function BillingSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Subscription"
        description="Your Kaarobar plan, how it's paid for, and its invoices."
      />
      {/* `BillingSettings` reads `?checkout=` and `?plan=`; Next needs a
          Suspense boundary around `useSearchParams` to prerender the rest. */}
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <BillingSettings />
      </Suspense>
    </>
  );
}
