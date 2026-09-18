"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { OrganizationForm } from "@/features/settings/OrganizationForm";

export default function OrganizationSettingsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Organization"
        description="Your company's details and the defaults new businesses start from."
      />
      <OrganizationForm />
    </>
  );
}
