"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { ShiftDetail } from "@/features/registers/ShiftDetail";

export default function ShiftDetailPage({ params }: PageProps<"/shifts/[shiftId]">) {
  const { shiftId } = use(params);

  return (
    <>
      <PageHeader eyebrow="Shifts" title="Shift" back={{ href: "/shifts", label: "All shifts" }} />
      <ShiftDetail shiftId={shiftId} />
    </>
  );
}
