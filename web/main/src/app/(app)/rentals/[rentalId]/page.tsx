"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { RentalDetail } from "@/features/rentals/RentalDetail";

export default function RentalPage({ params }: PageProps<"/rentals/[rentalId]">) {
  const { rentalId } = use(params);
  return (
    <RequireModule module="rentals">
      <PageHeader
        eyebrow="Hire"
        title="Hire"
        back={{ href: "/rentals", label: "All hires" }}
        compact
      />
      <RentalDetail rentalId={rentalId} />
    </RequireModule>
  );
}
