"use client";

import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { ServiceJobDetail } from "@/features/serviceJobs/ServiceJobDetail";
import { useServiceJob } from "@/hooks/queries/useServiceJobs";

/** Inside RequireModule, so a business without the module never asks for it. */
function Header({ id }: { id: string }) {
  // The detail below reads the same cache entry; this only names the tab.
  const { data } = useServiceJob(id);
  return (
    <PageHeader
      eyebrow="Service desk"
      title="Job"
      documentTitle={data?.number ?? "Job"}
      back={{ href: "/service-jobs", label: "All jobs" }}
      compact
    />
  );
}

export default function ServiceJobPage({ params }: PageProps<"/service-jobs/[jobId]">) {
  const { jobId } = use(params);
  return (
    <RequireModule module="service_jobs">
      <Header id={jobId} />
      <ServiceJobDetail jobId={jobId} />
    </RequireModule>
  );
}
