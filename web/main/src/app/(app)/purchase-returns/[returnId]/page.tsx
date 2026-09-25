"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PurchaseReturnDetail } from "@/features/purchasing/PurchaseReturnDetail";

export default function PurchaseReturnDetailPage({
  params,
}: PageProps<"/purchase-returns/[returnId]">) {
  const { returnId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Purchase returns"
        title="Purchase return"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/purchase-returns" />}>
            <ArrowLeft className="size-4" />
            All returns
          </Button>
        }
      />
      <PurchaseReturnDetail returnId={returnId} />
    </>
  );
}
