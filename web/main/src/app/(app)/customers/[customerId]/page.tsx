"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { CustomerDetail } from "@/features/customers/CustomerDetail";
import { useCustomer } from "@/hooks/queries/useCustomers";

export default function CustomerDetailPage({ params }: PageProps<"/customers/[customerId]">) {
  const { customerId } = use(params);
  // The same cache entry CustomerDetail reads, so the tab can name them.
  const { data: customer } = useCustomer(customerId);

  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Customer"
        documentTitle={customer?.name ?? "Customer"}
        back={{ href: "/customers", label: "All customers" }}
        compact
      />
      <CustomerDetail customerId={customerId} />
    </>
  );
}
