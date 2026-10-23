"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { QuoteDetail } from "@/features/quotes/QuoteDetail";

export default function QuotePage({ params }: PageProps<"/quotes/[quoteId]">) {
  const { quoteId } = use(params);
  return (
    <RequireModule module="quotes">
      <PageHeader
        eyebrow="Quotes"
        title="Quote"
        back={{ href: "/quotes", label: "All quotes" }}
        compact
      />
      <QuoteDetail quoteId={quoteId} />
    </RequireModule>
  );
}
