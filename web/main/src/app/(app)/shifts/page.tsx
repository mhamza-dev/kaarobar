"use client";

import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { CloseShiftDialog } from "@/features/registers/CloseShiftDialog";
import { ShiftsTable } from "@/features/registers/ShiftsTable";
import { usePermission } from "@/hooks/usePermission";
import type { Shift } from "@/types/api/sales";

export default function ShiftsPage() {
  const { can } = usePermission();
  const [closing, setClosing] = useState<Shift | null>(null);

  return (
    <>
      <PageHeader
        eyebrow="Registers"
        title="Shifts"
        description="Each time a drawer was opened, and whether it balanced."
      />

      <ShiftsTable
        onOpenShift={(shift) => {
          // Only an open shift can be closed, and only with the permission.
          if (shift.status === "open" && can("shift:close")) setClosing(shift);
        }}
      />

      <CloseShiftDialog shift={closing} onOpenChange={(open) => !open && setClosing(null)} />
    </>
  );
}
