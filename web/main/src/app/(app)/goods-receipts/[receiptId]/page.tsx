"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { GoodsReceiptDetail } from "@/features/purchasing/GoodsReceiptDetail";

export default function GoodsReceiptDetailPage({
  params,
}: PageProps<"/goods-receipts/[receiptId]">) {
  const { receiptId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Goods receipts"
        title="Goods receipt"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/goods-receipts" />}>
            <ArrowLeft className="size-4" />
            All receipts
          </Button>
        }
      />
      <GoodsReceiptDetail receiptId={receiptId} />
    </>
  );
}
