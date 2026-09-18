"use client";

import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { StaffTable } from "@/features/settings/StaffTable";

export default function StaffPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Staff"
        description="Everyone who works here, and what each of them can do."
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/settings/staff/invitations" />}
          >
            Invitations
          </Button>
        }
      />
      <StaffTable />
    </>
  );
}
