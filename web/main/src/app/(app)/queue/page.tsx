"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { QueueBoard } from "@/features/scheduling/QueueBoard";

export default function QueuePage() {
  return (
    <RequireModule module="queue">
      <PageHeader eyebrow="Bookings" title="Walk-in queue" description="Who's waiting, in order." />
      <QueueBoard />
    </RequireModule>
  );
}
