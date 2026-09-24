"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { use } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { ServiceJobDetail } from "@/features/serviceJobs/ServiceJobDetail";

export default function ServiceJobPage({ params }: PageProps<"/service-jobs/[jobId]">) {
  const { jobId } = use(params);
  return (
    <RequireModule module="service_jobs">
      <PageHeader
        eyebrow="Service desk"
        title="Job"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/service-jobs" />}>
            <ArrowLeft className="size-4" />
            All jobs
          </Button>
        }
      />
      <ServiceJobDetail jobId={jobId} />
    </RequireModule>
  );
}
