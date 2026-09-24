"use client";

import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { KitchenBoard } from "@/features/dining/KitchenBoard";

export default function KitchenPage() {
  return (
    <RequireModule module="kitchen">
      <PageHeader
        eyebrow="Kitchen"
        title="Kitchen board"
        description="Tickets as they're fired, oldest and latest first."
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/kitchen/stations" />}>
            Stations
          </Button>
        }
      />
      <KitchenBoard />
    </RequireModule>
  );
}
