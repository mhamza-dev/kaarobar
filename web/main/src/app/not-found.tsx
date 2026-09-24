import Link from "next/link";

/** Any URL that matches no route — a stale bookmark, a mistyped path. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-sm font-semibold text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">There&apos;s nothing at this address</h1>
      <p className="text-sm text-muted-foreground">
        The link may be old, or the page may have moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Go to the dashboard
      </Link>
    </main>
  );
}
