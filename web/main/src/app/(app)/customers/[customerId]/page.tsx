"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { CustomerDetail } from "@/features/customers/CustomerDetail";

export default function CustomerDetailPage({ params }: PageProps<"/customers/[customerId]">) {
  const { customerId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Customer"
        back={{ href: "/customers", label: "All customers" }}
        compact
      />
      <CustomerDetail customerId={customerId} />
    </>
  );
}
