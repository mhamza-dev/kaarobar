"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { ResourcesTable } from "@/features/scheduling/ResourcesTable";

export default function AppointmentsResourcesPage() {
  return (
    <RequireModule module="appointments">
      <PageHeader
        eyebrow="Bookings"
        title="Resources"
        description="Staff, chairs and rooms that can be booked."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/appointments" />}>
            <ArrowLeft className="size-4" />
            Diary
          </Button>
        }
      />
      <ResourcesTable />
    </RequireModule>
  );
}
