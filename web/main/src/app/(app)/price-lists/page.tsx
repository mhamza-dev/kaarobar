"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PriceListDialog, PriceListsTable } from "@/features/pricing/PriceLists";
import { usePermission } from "@/hooks/usePermission";

export default function PriceListsPage() {
  const { can } = usePermission();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Price lists"
        description="Different prices for wholesale, a branch or a sales channel."
        actions={
          can("price_list:manage") && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              New price list
            </Button>
          )
        }
      />
      <PriceListsTable />
      <PriceListDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}
