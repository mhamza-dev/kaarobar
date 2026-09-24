"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { CustomerGroupsTable } from "@/features/customers/CustomerGroupsTable";

export default function CustomerGroupsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Customer groups"
        description="Shared terms — discounts, credit and payment days — for a set of customers."
      />
      <CustomerGroupsTable />
    </>
  );
}
