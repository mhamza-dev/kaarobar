"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { RentalDetail } from "@/features/rentals/RentalDetail";

export default function RentalPage({ params }: PageProps<"/rentals/[rentalId]">) {
  const { rentalId } = use(params);
  return (
    <RequireModule module="rentals">
      <PageHeader
        eyebrow="Hire"
        title="Hire"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/rentals" />}>
            <ArrowLeft className="size-4" />
            All hires
          </Button>
        }
      />
      <RentalDetail rentalId={rentalId} />
    </RequireModule>
  );
}
