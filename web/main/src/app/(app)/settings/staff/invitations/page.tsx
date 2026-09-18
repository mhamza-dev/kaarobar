"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { InvitationsTable } from "@/features/settings/InvitationsTable";

export default function InvitationsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Staff"
        title="Invitations"
        description="People invited to join, and whether they've accepted yet."
        actions={
          <Button variant="outline" render={<Link href="/settings/staff" />}>
            <ArrowLeft className="size-4" />
            Staff
          </Button>
        }
      />
      <InvitationsTable />
    </>
  );
}
