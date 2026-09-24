"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { ServiceJobsTable } from "@/features/serviceJobs/ServiceJobsTable";

export default function ServiceJobsPage() {
  return (
    <RequireModule module="service_jobs">
      <PageHeader
        eyebrow="Service desk"
        title="Jobs"
        description="Work taken in, and where it's up to."
      />
      <ServiceJobsTable />
    </RequireModule>
  );
}
