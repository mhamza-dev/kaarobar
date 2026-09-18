"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { CountDetail } from "@/features/inventory/CountDetail";

export default function CountDetailPage({ params }: PageProps<"/stock-counts/[countId]">) {
  const { countId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Stock counts"
        title="Count sheet"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/stock-counts" />}>
            <ArrowLeft className="size-4" />
            All counts
          </Button>
        }
      />
      <CountDetail countId={countId} />
    </>
  );
}
