"use client";

import { Package, Receipt, Users, Wallet } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { useSessionStore } from "@/stores/sessionStore";

const PLACEHOLDER_STATS = [
  { label: "Today's sales", value: "—", icon: Receipt },
  { label: "Products", value: "—", icon: Package },
  { label: "Staff", value: "—", icon: Users },
  { label: "Outstanding credit", value: "—", icon: Wallet },
];

export default function DashboardPage() {
  const scope = useSessionStore((state) => state.scope);

  return (
    <>
      <PageHeader
        eyebrow={scope?.business?.name}
        title={`Welcome back, ${scope?.user?.name.split(" ")[0] ?? ""}`}
        description="Here's how things stand today."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLACEHOLDER_STATS.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Reporting is on its way</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Sales, inventory and staff activity will show up here as those modules ship. For now, head
          to Settings to invite your team and Products to start building your catalog.
        </CardContent>
      </Card>
    </>
  );
}
