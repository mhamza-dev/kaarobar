"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { SessionDetail } from "@/features/dining/SessionDetail";
import { useTableSession } from "@/hooks/queries/useDining";

/** Inside RequireModule, so a business without the module never asks for it. */
function Header({ id }: { id: string }) {
  // The detail below reads the same cache entry; this only names the tab.
  const { data } = useTableSession(id);
  return (
    <PageHeader
      eyebrow="Dining"
      title="Table"
      documentTitle={data?.dining_table?.name ?? "Table"}
      back={{ href: "/dining", label: "Floor" }}
      compact
    />
  );
}

export default function TableSessionPage({ params }: PageProps<"/dining/sessions/[sessionId]">) {
  const { sessionId } = use(params);
  return (
    <RequireModule module="tables">
      <Header id={sessionId} />
      <SessionDetail sessionId={sessionId} />
    </RequireModule>
  );
}
