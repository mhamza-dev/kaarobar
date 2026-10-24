"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { RentalDetail } from "@/features/rentals/RentalDetail";
import { useRental } from "@/hooks/queries/useRentals";

/** Inside RequireModule, so a business without the module never asks for it. */
function Header({ id }: { id: string }) {
  // The detail below reads the same cache entry; this only names the tab.
  const { data } = useRental(id);
  return (
    <PageHeader
      eyebrow="Hire"
      title="Hire"
      documentTitle={data?.number ?? "Hire"}
      back={{ href: "/rentals", label: "All hires" }}
      compact
    />
  );
}

export default function RentalPage({ params }: PageProps<"/rentals/[rentalId]">) {
  const { rentalId } = use(params);
  return (
    <RequireModule module="rentals">
      <Header id={rentalId} />
      <RentalDetail rentalId={rentalId} />
    </RequireModule>
  );
}
