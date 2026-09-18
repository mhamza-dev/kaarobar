"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
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
        actions={
          <Button variant="outline" render={<Link href="/settings/businesses" />}>
            <ArrowLeft className="size-4" />
            All businesses
          </Button>
        }
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
