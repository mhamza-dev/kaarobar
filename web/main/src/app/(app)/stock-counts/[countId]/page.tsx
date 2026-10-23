"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { CountDetail } from "@/features/inventory/CountDetail";

export default function CountDetailPage({ params }: PageProps<"/stock-counts/[countId]">) {
  const { countId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Stock counts"
        title="Count sheet"
        back={{ href: "/stock-counts", label: "All counts" }}
      />
      <CountDetail countId={countId} />
    </>
  );
}
