"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RolesTable } from "@/features/settings/RolesTable";

export default function RolesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Roles"
        description="Bundles of permissions you assign to staff. Built-in roles can't be changed."
      />
      <RolesTable />
    </>
  );
}
