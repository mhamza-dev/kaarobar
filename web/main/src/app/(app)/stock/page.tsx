"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { OpeningStockDialog } from "@/features/inventory/OpeningStockDialog";
import { StockScreen } from "@/features/inventory/StockScreen";
import { usePermission } from "@/hooks/usePermission";

export default function StockPage() {
  const { can } = usePermission();

  return (
    <>
      <PageHeader
        eyebrow="Inventory"
        title="Stock"
        description="What's on hand at each branch, and what's actually available to sell."
        actions={can("stock:adjust") && <OpeningStockDialog />}
      />
      <StockScreen />
    </>
  );
}
