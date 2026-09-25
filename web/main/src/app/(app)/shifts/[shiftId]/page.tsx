"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { ShiftDetail } from "@/features/registers/ShiftDetail";

export default function ShiftDetailPage({ params }: PageProps<"/shifts/[shiftId]">) {
  const { shiftId } = use(params);

  return (
    <>
      <PageHeader
        eyebrow="Shifts"
        title="Shift"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/shifts" />}>
            <ArrowLeft className="size-4" />
            All shifts
          </Button>
        }
      />
      <ShiftDetail shiftId={shiftId} />
    </>
  );
}
