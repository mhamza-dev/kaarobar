"use client";

import { useRouter } from "next/navigation";

import { PageHeader } from "@/components/shared/PageHeader";
import { ShiftsTable } from "@/features/registers/ShiftsTable";

export default function ShiftsPage() {
  const router = useRouter();

  return (
    <>
      <PageHeader
        eyebrow="Registers"
        title="Shifts"
        description="Each time a drawer was opened, and whether it balanced."
      />
      <ShiftsTable onOpenShift={(shift) => router.push(`/shifts/${shift.id}`)} />
    </>
  );
}
