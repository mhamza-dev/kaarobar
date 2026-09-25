"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { SupplierBillDialog } from "@/features/purchasing/SupplierBillDialog";
import { SupplierBillsTable } from "@/features/purchasing/SupplierBillsTable";
import { SupplierPaymentDialog } from "@/features/purchasing/SupplierPaymentDialog";
import { usePermission } from "@/hooks/usePermission";

export default function SupplierBillsPage() {
  const { can } = usePermission();

  return (
    <>
      <PageHeader
        eyebrow="Purchasing"
        title="Supplier bills"
        description="What you owe, and how overdue it is."
        actions={
          <>
            {can("supplier_payment:record") && <SupplierPaymentDialog />}
            {can("supplier_bill:manage") && <SupplierBillDialog />}
          </>
        }
      />
      <SupplierBillsTable />
    </>
  );
}
