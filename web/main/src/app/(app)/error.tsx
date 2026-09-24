"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/ui/button";

/**
 * A render crash inside an authenticated page.
 *
 * Sits inside `(app)/layout.tsx`, so the sidebar and business switcher
 * survive — the user can retry or go somewhere else without reloading the
 * app. Failed requests never land here; React Query turns those into each
 * screen's own error state.
 */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled page error", error);
  }, [error]);

  return (
    <EmptyState
      icon={AlertTriangle}
      title="This page hit a problem"
      description={
        error.digest
          ? `Reference ${error.digest}. Try again, or go back to the dashboard.`
          : "Try again, or go back to the dashboard."
      }
      action={
        <div className="flex gap-2">
          <Button onClick={() => retry()}>Try again</Button>
          <Button variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
            Dashboard
          </Button>
        </div>
      }
    />
  );
}
