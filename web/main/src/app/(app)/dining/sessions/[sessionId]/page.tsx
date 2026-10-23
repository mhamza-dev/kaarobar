"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { SessionDetail } from "@/features/dining/SessionDetail";

export default function TableSessionPage({ params }: PageProps<"/dining/sessions/[sessionId]">) {
  const { sessionId } = use(params);
  return (
    <RequireModule module="tables">
      <PageHeader
        eyebrow="Dining"
        title="Table"
        back={{ href: "/dining", label: "Floor" }}
        compact
      />
      <SessionDetail sessionId={sessionId} />
    </RequireModule>
  );
}
