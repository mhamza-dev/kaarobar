"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { FiscalSettings } from "@/features/finance/FiscalSettings";

export default function FiscalSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Fiscal reporting"
        description="Reporting sales to the tax authority."
      />
      <FiscalSettings />
    </>
  );
}
