"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { BusinessesTable } from "@/features/settings/BusinessesTable";

export default function BusinessesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Businesses"
        description="Every business in your organization. Select one to edit its details and branding."
      />
      <BusinessesTable />
    </>
  );
}
