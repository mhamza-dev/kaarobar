"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { Dashboard } from "@/features/reports/Dashboard";
import { useSessionStore } from "@/stores/sessionStore";

export default function DashboardPage() {
  const scope = useSessionStore((state) => state.scope);

  return (
    <>
      <PageHeader
        eyebrow={scope?.business?.name}
        title={`Welcome back, ${scope?.user?.name.split(" ")[0] ?? ""}`}
        description="Here's how things stand today."
      />
      <Dashboard />
    </>
  );
}
