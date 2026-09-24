"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { StationsTable } from "@/features/dining/StationsTable";

export default function KitchenStationsPage() {
  return (
    <RequireModule module="kitchen">
      <PageHeader
        eyebrow="Kitchen"
        title="Stations"
        description="Where each dish is cooked, and how long it should take."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/kitchen" />}>
            <ArrowLeft className="size-4" />
            Board
          </Button>
        }
      />
      <StationsTable />
    </RequireModule>
  );
}
