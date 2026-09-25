"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { TimeScreen, LogTimeDialog } from "@/features/operations/TimeScreen";
import { usePermission } from "@/hooks/usePermission";

export default function TimePage() {
  const { can } = usePermission();
  return (
    <RequireModule module="time_entries">
      <PageHeader
        eyebrow="Work"
        title="Time"
        description="Hours worked for clients, and what is still to bill."
        actions={can("time_entry:record") && <LogTimeDialog />}
      />
      <TimeScreen />
    </RequireModule>
  );
}
