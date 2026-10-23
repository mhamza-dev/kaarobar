"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { PurchaseOrderDetail } from "@/features/purchasing/PurchaseOrderDetail";

export default function PurchaseOrderDetailPage({
  params,
}: PageProps<"/purchase-orders/[orderId]">) {
  const { orderId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Purchase orders"
        title="Purchase order"
        back={{ href: "/purchase-orders", label: "All orders" }}
      />
      <PurchaseOrderDetail orderId={orderId} />
    </>
  );
}
