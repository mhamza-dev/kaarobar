"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { SaleDetail } from "@/features/sales/SaleDetail";

export default function SaleDetailPage({ params }: PageProps<"/sales/[saleId]">) {
  const { saleId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Sales"
        title="Sale"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/sales" />}>
            <ArrowLeft className="size-4" />
            All sales
          </Button>
        }
      />
      <SaleDetail saleId={saleId} />
    </>
  );
}
