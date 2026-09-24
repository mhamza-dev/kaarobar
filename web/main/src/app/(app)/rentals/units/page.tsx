"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { RentalUnitsTable } from "@/features/rentals/RentalUnitsTable";

export default function RentalsUnitsPage() {
  return (
    <RequireModule module="rentals">
      <PageHeader
        eyebrow="Hire"
        title="Units"
        description="Everything you hire out, by asset code."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/rentals" />}>
            <ArrowLeft className="size-4" />
            Hires
          </Button>
        }
      />
      <RentalUnitsTable />
    </RequireModule>
  );
}
