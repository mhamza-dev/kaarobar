"use client";

import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { Diary } from "@/features/scheduling/Diary";

export default function AppointmentsPage() {
  return (
    <RequireModule module="appointments">
      <PageHeader
        eyebrow="Bookings"
        title="Diary"
        description="The day's bookings, by who's doing them."
        actions={
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href="/appointments/resources" />}
          >
            Resources
          </Button>
        }
      />
      <Diary />
    </RequireModule>
  );
}
