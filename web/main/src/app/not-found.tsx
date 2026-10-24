import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";

import { LogoMark } from "@/components/shared/LogoMark";

/** Any URL that matches no route — a stale bookmark, a mistyped path. */
export default function NotFound() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-canvas p-6 text-center">
      <title>Page not found · Kaarobar</title>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,color-mix(in_oklab,var(--primary)_14%,transparent),transparent)]"
      />
      <div className="relative flex max-w-md flex-col items-center gap-5">
        <Link href="/dashboard" aria-label="Kaarobar home" className="mb-4">
          <LogoMark className="size-10" />
        </Link>
        <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-card text-muted-foreground shadow-card">
          <Compass className="size-6" aria-hidden />
        </span>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-primary">404</p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            There&apos;s nothing at this address
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            The link may be old, or the page may have moved. Everything else is where you left it.
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-brand-primary-hover focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to the dashboard
        </Link>
      </div>
    </main>
  );
}
