"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { QuoteForm } from "@/features/quotes/QuoteForm";

export default function QuotesNewPage() {
  return (
    <RequireModule module="quotes">
      <PageHeader
        eyebrow="Quotes"
        title="New quote"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/quotes" />}>
            <ArrowLeft className="size-4" />
            All quotes
          </Button>
        }
      />
      <QuoteForm />
    </RequireModule>
  );
}
