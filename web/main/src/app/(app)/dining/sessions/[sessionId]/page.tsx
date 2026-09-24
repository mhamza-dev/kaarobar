"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { SessionDetail } from "@/features/dining/SessionDetail";

export default function TableSessionPage({ params }: PageProps<"/dining/sessions/[sessionId]">) {
  const { sessionId } = use(params);
  return (
    <RequireModule module="tables">
      <PageHeader
        eyebrow="Dining"
        title="Table"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/dining" />}>
            <ArrowLeft className="size-4" />
            Floor
          </Button>
        }
      />
      <SessionDetail sessionId={sessionId} />
    </RequireModule>
  );
}
