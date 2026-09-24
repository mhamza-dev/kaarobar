"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { FloorPlan } from "@/features/dining/FloorPlan";

export default function DiningPage() {
  return (
    <RequireModule module="tables">
      <PageHeader
        eyebrow="Dining"
        title="Floor"
        description="Who's sitting where, and for how long."
      />
      <FloorPlan />
    </RequireModule>
  );
}
