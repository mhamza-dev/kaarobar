"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { CommissionsScreen } from "@/features/operations/CommissionsScreen";

export default function CommissionsPage() {
  return (
    <RequireModule module="commissions">
      <PageHeader
        eyebrow="Staff"
        title="Commissions"
        description="What staff have earned on their sales."
      />
      <CommissionsScreen />
    </RequireModule>
  );
}
