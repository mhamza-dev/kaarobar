"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { QuoteDetail } from "@/features/quotes/QuoteDetail";

export default function QuotePage({ params }: PageProps<"/quotes/[quoteId]">) {
  const { quoteId } = use(params);
  return (
    <RequireModule module="quotes">
      <PageHeader
        eyebrow="Quotes"
        title="Quote"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/quotes" />}>
            <ArrowLeft className="size-4" />
            All quotes
          </Button>
        }
      />
      <QuoteDetail quoteId={quoteId} />
    </RequireModule>
  );
}
