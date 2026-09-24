"use client";

import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { RentalsTable } from "@/features/rentals/RentalsTable";

export default function RentalsPage() {
  return (
    <RequireModule module="rentals">
      <PageHeader
        eyebrow="Hire"
        title="Hires"
        description="What's out, what's due back, and what's late."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/rentals/units" />}>
            Units
          </Button>
        }
      />
      <RentalsTable />
    </RequireModule>
  );
}
