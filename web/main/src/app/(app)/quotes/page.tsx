"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { QuotesTable } from "@/features/quotes/QuotesTable";

export default function QuotesPage() {
  return (
    <RequireModule module="quotes">
      <PageHeader
        eyebrow="Quotes"
        title="Quotes"
        description="Estimates you've sent, and which ones you won."
      />
      <QuotesTable />
    </RequireModule>
  );
}
