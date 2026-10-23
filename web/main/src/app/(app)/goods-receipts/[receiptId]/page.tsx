"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
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
        back={{ href: "/goods-receipts", label: "All receipts" }}
      />
      <GoodsReceiptDetail receiptId={receiptId} />
    </>
  );
}
