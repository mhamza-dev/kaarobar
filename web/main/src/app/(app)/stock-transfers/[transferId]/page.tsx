"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { TransferDetail } from "@/features/inventory/TransferDetail";

export default function TransferDetailPage({ params }: PageProps<"/stock-transfers/[transferId]">) {
  const { transferId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Stock transfers"
        title="Transfer"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/stock-transfers" />}>
            <ArrowLeft className="size-4" />
            All transfers
          </Button>
        }
      />
      <TransferDetail transferId={transferId} />
    </>
  );
}
