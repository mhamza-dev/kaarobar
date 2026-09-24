"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Skeleton } from "@/components/ui/skeleton";
import { QuoteForm } from "@/features/quotes/QuoteForm";
import { useQuote } from "@/hooks/queries/useQuotes";

export default function EditQuotePage({ params }: PageProps<"/quotes/[quoteId]/edit">) {
  const { quoteId } = use(params);
  const { data: quote, isLoading } = useQuote(quoteId);

  return (
    <RequireModule module="quotes">
      <PageHeader eyebrow="Quotes" title={quote ? `Edit ${quote.number}` : "Edit quote"} />
      {isLoading || !quote ? <Skeleton className="h-64 w-full" /> : <QuoteForm quote={quote} />}
    </RequireModule>
  );
}
