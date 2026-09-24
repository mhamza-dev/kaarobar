"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { ReportsScreen } from "@/features/reports/ReportsScreen";

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Sales reports"
        description="How the business is doing, over any period."
      />
      <ReportsScreen />
    </>
  );
}
