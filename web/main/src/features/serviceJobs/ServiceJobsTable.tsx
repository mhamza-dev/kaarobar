"use client";

import { Plus, Tag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataTable, type DataTableColumn } from "@/components/shared/DataTable/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServiceJobs } from "@/hooks/queries/useServiceJobs";
import { usePermission } from "@/hooks/usePermission";
import { toast } from "@/hooks/useToast";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { getServiceJobByTag } from "@/services/serviceJobs";
import { useSessionStore } from "@/stores/sessionStore";
import { JOB_STATUSES, type ServiceJob } from "@/types/api/serviceJobs";

/**
 * The service desk's list, plus the counter's fastest path: type or scan the
 * ticket tag a customer hands over and jump straight to their job.
 */
export function ServiceJobsTable() {
  const router = useRouter();
  const { can } = usePermission();
  const currency = useSessionStore((state) => state.scope?.business?.currency) ?? "PKR";
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const { data, isLoading, error, refetch } = useServiceJobs({ status: status || undefined });

  const columns: DataTableColumn<ServiceJob>[] = [
    {
      key: "number",
      header: "Job",
      render: (job) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{job.number}</span>
          {job.priority !== "normal" && <Badge variant="secondary">{humanize(job.priority)}</Badge>}
        </div>
      ),
    },
    { key: "who", header: "Customer", render: (job) => job.who ?? "—" },
    { key: "items", header: "Items", align: "end", render: (job) => job.items?.length ?? "—" },
    {
      key: "promised",
      header: "Promised",
      render: (job) => (
        <span className={job.overdue ? "font-medium text-destructive" : undefined}>
          {formatDate(job.promised_on)}
        </span>
      ),
    },
    { key: "status", header: "Status", render: (job) => <StatusBadge status={job.status} /> },
    {
      key: "balance",
      header: "Balance due",
      align: "end",
      render: (job) => formatMoney(job.balance_due, currency, { showZero: false }),
    },
  ];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Filter by status"
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          >
            {/* No status means "still in the shop" (Job.holding_statuses). */}
            <option value="">In the shop</option>
            {JOB_STATUSES.map((value) => (
              <option key={value} value={value}>
                {humanize(value)}
              </option>
            ))}
            <option value="all">All jobs</option>
          </select>
          <form
            className="flex gap-1"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!tag.trim()) return;
              try {
                const job = await getServiceJobByTag(tag.trim());
                router.push(`/service-jobs/${job.id}`);
              } catch {
                toast.error(`No job has tag "${tag.trim()}"`);
              }
            }}
          >
            <Input
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder="Ticket tag"
              aria-label="Find by ticket tag"
              className="w-36"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Find job by tag">
              <Tag className="size-4" />
            </Button>
          </form>
        </div>
        {can("service_job:create") && (
          <Button nativeButton={false} render={<Link href="/service-jobs/new" />}>
            <Plus className="size-4" />
            Take in work
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={data ?? []}
        rowKey={(job) => job.id}
        loading={isLoading}
        error={error ? { message: error.message } : null}
        onRetry={() => refetch()}
        search={{ getText: (job) => `${job.number} ${job.who ?? ""} ${job.walk_in_phone ?? ""}` }}
        onRowClick={(job) => router.push(`/service-jobs/${job.id}`)}
        mobileCardTitle={(job) => job.number}
        mobileCardSubtitle={(job) => job.who ?? ""}
        mobileCardFields={[
          { key: "status", label: "Status", render: (job) => <StatusBadge status={job.status} /> },
          { key: "promised", label: "Promised", render: (job) => formatDate(job.promised_on) },
        ]}
      />
    </>
  );
}
