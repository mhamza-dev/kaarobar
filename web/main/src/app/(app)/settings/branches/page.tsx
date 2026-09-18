"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { BranchesTable } from "@/features/settings/BranchesTable";

export default function BranchesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Branches"
        description="The locations this business trades from."
      />
      <BranchesTable />
    </>
  );
}
