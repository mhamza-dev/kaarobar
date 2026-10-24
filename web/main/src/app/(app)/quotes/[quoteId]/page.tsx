"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { QuoteDetail } from "@/features/quotes/QuoteDetail";
import { useQuote } from "@/hooks/queries/useQuotes";

/** Inside RequireModule, so a business without the module never asks for it. */
function Header({ id }: { id: string }) {
  // The detail below reads the same cache entry; this only names the tab.
  const { data } = useQuote(id);
  return (
    <PageHeader
      eyebrow="Quotes"
      title="Quote"
      documentTitle={data?.number ?? "Quote"}
      back={{ href: "/quotes", label: "All quotes" }}
      compact
    />
  );
}

export default function QuotePage({ params }: PageProps<"/quotes/[quoteId]">) {
  const { quoteId } = use(params);
  return (
    <RequireModule module="quotes">
      <Header id={quoteId} />
      <QuoteDetail quoteId={quoteId} />
    </RequireModule>
  );
}
