"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { AuditLog } from "@/features/audit/AuditLog";

export default function AuditLogPage() {
  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Audit log"
        description="Who changed what, and when."
      />
      <AuditLog />
    </>
  );
}
