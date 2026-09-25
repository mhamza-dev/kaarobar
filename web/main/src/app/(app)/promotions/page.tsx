"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PromotionDialog, PromotionsTable } from "@/features/pricing/Promotions";
import { usePermission } from "@/hooks/usePermission";
import type { PriceRule } from "@/types/api/pricing";

export default function PromotionsPage() {
  const { can } = usePermission();
  const [editing, setEditing] = useState<PriceRule | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Promotions"
        description="Discounts the till applies by itself while they run."
        actions={
          can("price_rule:manage") && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" />
              New promotion
            </Button>
          )
        }
      />
      <PromotionsTable onEdit={setEditing} />
      <PromotionDialog
        rule={editing}
        open={creating || !!editing}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      />
    </>
  );
}
