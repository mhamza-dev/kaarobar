"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { SupplierBillDetail } from "@/features/purchasing/SupplierBillDetail";

export default function SupplierBillDetailPage({ params }: PageProps<"/supplier-bills/[billId]">) {
  const { billId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Supplier bills"
        title="Supplier bill"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/supplier-bills" />}>
            <ArrowLeft className="size-4" />
            All bills
          </Button>
        }
      />
      <SupplierBillDetail billId={billId} />
    </>
  );
}
