"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { CheckoutScreen } from "@/features/pos/CheckoutScreen";

export default function PosPage({ searchParams }: PageProps<"/pos">) {
  // `?order=<id>` settles an open ticket — a table's bill — at this till.
  const { order } = use(searchParams);
  const orderId = typeof order === "string" ? order : undefined;

  return (
    <>
      <PageHeader
        eyebrow="Sell"
        title={orderId ? "Settle bill" : "Till"}
        description={orderId ? "Take payment for an open order." : "Scan, take payment, print."}
      />
      <CheckoutScreen key={orderId ?? "basket"} orderId={orderId} />
    </>
  );
}
