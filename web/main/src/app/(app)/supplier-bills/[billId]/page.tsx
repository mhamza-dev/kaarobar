"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { SupplierBillDetail } from "@/features/purchasing/SupplierBillDetail";

export default function SupplierBillDetailPage({ params }: PageProps<"/supplier-bills/[billId]">) {
  const { billId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Supplier bills"
        title="Supplier bill"
        back={{ href: "/supplier-bills", label: "All bills" }}
      />
      <SupplierBillDetail billId={billId} />
    </>
  );
}
