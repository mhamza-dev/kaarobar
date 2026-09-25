"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { DeliveriesScreen, NewDeliveryDialog } from "@/features/operations/DeliveriesScreen";
import { usePermission } from "@/hooks/usePermission";

export default function DeliveriesPage() {
  const { can } = usePermission();
  return (
    <RequireModule module="delivery">
      <PageHeader
        eyebrow="Sell"
        title="Deliveries"
        description="What's out, with whom, and what's late."
        actions={can("delivery:assign") && <NewDeliveryDialog />}
      />
      <DeliveriesScreen />
    </RequireModule>
  );
}
