"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { ServiceJobDetail } from "@/features/serviceJobs/ServiceJobDetail";

export default function ServiceJobPage({ params }: PageProps<"/service-jobs/[jobId]">) {
  const { jobId } = use(params);
  return (
    <RequireModule module="service_jobs">
      <PageHeader
        eyebrow="Service desk"
        title="Job"
        back={{ href: "/service-jobs", label: "All jobs" }}
        compact
      />
      <ServiceJobDetail jobId={jobId} />
    </RequireModule>
  );
}
