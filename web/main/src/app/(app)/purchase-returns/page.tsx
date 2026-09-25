"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { PurchaseReturnDialog } from "@/features/purchasing/PurchaseReturnDialog";
import { PurchaseReturnsTable } from "@/features/purchasing/PurchaseReturnsTable";
import { usePermission } from "@/hooks/usePermission";

export default function PurchaseReturnsPage() {
  const { can } = usePermission();

  return (
    <>
      <PageHeader
        eyebrow="Purchasing"
        title="Purchase returns"
        description="Goods sent back to a supplier."
        actions={can("purchase_return:manage") && <PurchaseReturnDialog />}
      />
      <PurchaseReturnsTable />
    </>
  );
}
