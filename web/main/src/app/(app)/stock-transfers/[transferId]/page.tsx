"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { TransferDetail } from "@/features/inventory/TransferDetail";

export default function TransferDetailPage({ params }: PageProps<"/stock-transfers/[transferId]">) {
  const { transferId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Stock transfers"
        title="Transfer"
        back={{ href: "/stock-transfers", label: "All transfers" }}
      />
      <TransferDetail transferId={transferId} />
    </>
  );
}
