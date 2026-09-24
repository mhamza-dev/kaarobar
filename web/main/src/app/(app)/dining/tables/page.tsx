"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { TablesManager } from "@/features/dining/TablesManager";

export default function DiningTablesPage() {
  return (
    <RequireModule module="tables">
      <PageHeader
        eyebrow="Dining"
        title="Tables"
        description="Floors and tables for the floor plan."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/dining" />}>
            <ArrowLeft className="size-4" />
            Floor
          </Button>
        }
      />
      <TablesManager />
    </RequireModule>
  );
}
