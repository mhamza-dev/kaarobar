"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { CustomersTable } from "@/features/customers/CustomersTable";

export default function CustomersPage() {
  return (
    <>
      <PageHeader
        eyebrow="Customers"
        title="Customers"
        description="Who buys from you, and who is buying on account."
      />
      <CustomersTable />
    </>
  );
}
