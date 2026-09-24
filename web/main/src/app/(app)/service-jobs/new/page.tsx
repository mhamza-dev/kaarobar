"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/PageHeader";
import { RequireModule } from "@/components/shared/RequireModule";
import { Button } from "@/components/ui/button";
import { ServiceJobForm } from "@/features/serviceJobs/ServiceJobForm";

export default function ServiceJobsNewPage() {
  return (
    <RequireModule module="service_jobs">
      <PageHeader
        eyebrow="Service desk"
        title="Take in work"
        actions={
          <Button variant="outline" nativeButton={false} render={<Link href="/service-jobs" />}>
            <ArrowLeft className="size-4" />
            All jobs
          </Button>
        }
      />
      <ServiceJobForm />
    </RequireModule>
  );
}
