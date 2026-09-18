"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
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
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/purchase-orders" />}>
            <ArrowLeft className="size-4" />
            All orders
          </Button>
        }
      />
      <PurchaseOrderDetail orderId={orderId} />
    </>
  );
}
