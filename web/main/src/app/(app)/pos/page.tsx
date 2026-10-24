"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { CheckoutScreen } from "@/features/pos/CheckoutScreen";

export default function PosPage({ searchParams }: PageProps<"/pos">) {
  // `?order=<id>` settles an open ticket — a table's bill — at this till.
  const { order } = use(searchParams);
  const orderId = typeof order === "string" ? order : undefined;

  // From `lg` up the till fills the screen: the catalog and the basket
  // scroll on their own, and the pay button never leaves view.
  return (
    <div className="flex flex-col lg:h-full">
      <PageHeader
        eyebrow="Sell"
        title={orderId ? "Settle bill" : "Till"}
        description={orderId ? "Take payment for an open order." : undefined}
      />
      <div className="lg:min-h-0 lg:flex-1">
        <CheckoutScreen key={orderId ?? "basket"} orderId={orderId} />
      </div>
    </div>
  );
}
