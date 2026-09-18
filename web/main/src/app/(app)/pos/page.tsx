"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { CheckoutScreen } from "@/features/pos/CheckoutScreen";

export default function PosPage() {
  return (
    <>
      <PageHeader eyebrow="Sell" title="Till" description="Scan, take payment, print." />
      <CheckoutScreen />
    </>
  );
}
