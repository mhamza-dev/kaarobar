"use client";

import { format } from "date-fns";

import { PageHeader } from "@/components/shared/PageHeader";
import { Dashboard } from "@/features/reports/Dashboard";
import { shopToday } from "@/lib/reportPeriod";
import { greeting } from "@/lib/trend";
import { useSessionStore } from "@/stores/sessionStore";

export default function DashboardPage() {
  const scope = useSessionStore((state) => state.scope);
  const timezone = scope?.business?.timezone;
  const firstName = scope?.user?.name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader
        eyebrow={scope?.business?.name}
        title={`${greeting(timezone)}, ${firstName}`}
        documentTitle="Dashboard"
        description={`${format(shopToday(timezone), "EEEE d MMMM")} — here's how things stand today.`}
      />
      <Dashboard />
    </>
  );
}
