"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { BusinessForm } from "@/features/settings/BusinessForm";
import { useBusiness } from "@/hooks/queries/useBusinesses";

export default function BusinessDetailPage({
  params,
}: PageProps<"/settings/businesses/[businessId]">) {
  const { businessId } = use(params);
  const { data: business, isLoading, isError } = useBusiness(businessId);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title={business?.name ?? "Business"}
        description={business?.business_type_label}
        back={{ href: "/settings/businesses", label: "All businesses" }}
      />

      {isLoading ? (
        <div className="flex max-w-2xl flex-col gap-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      ) : isError || !business ? (
        <p className="text-sm text-muted-foreground">We couldn&apos;t load this business.</p>
      ) : (
        <BusinessForm business={business} />
      )}
    </>
  );
}
