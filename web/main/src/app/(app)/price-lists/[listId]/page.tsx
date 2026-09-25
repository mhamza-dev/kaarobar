"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { PriceListDetail } from "@/features/pricing/PriceLists";

export default function PriceListPage({ params }: PageProps<"/price-lists/[listId]">) {
  const { listId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Price lists"
        title="Price list"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/price-lists" />}>
            <ArrowLeft className="size-4" />
            All price lists
          </Button>
        }
      />
      <PriceListDetail listId={listId} />
    </>
  );
}
