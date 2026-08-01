/** Lightweight skeleton primitives for buyer marketplace loading states. */

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-bg-tertiary ${className}`}
      aria-hidden
    />
  );
}

export function BuyerDiscoverSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <div className="overflow-hidden rounded-md border border-border bg-card">
            <Skeleton className="h-28 w-full rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function BuyerProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-md border border-border bg-card"
        >
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2.5 p-4">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="mt-2 h-6 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BuyerOrderListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <ul className="space-y-3" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-4 rounded-md border border-border bg-card p-4"
        >
          <Skeleton className="h-12 w-12 shrink-0 rounded-md" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-6 w-20" />
        </li>
      ))}
    </ul>
  );
}

export function BuyerOrderDetailSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <div className="overflow-hidden rounded-md border border-border bg-card p-6 space-y-4">
        <Skeleton className="h-7 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
        <div className="space-y-3 border-t border-border pt-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="ml-auto h-8 w-28" />
      </div>
    </div>
  );
}

export function BuyerLoyaltySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-36 rounded-md" />
        <Skeleton className="h-36 rounded-md" />
      </div>
    </div>
  );
}

export function BuyerArSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-24 rounded-md" />
        <Skeleton className="h-24 rounded-md" />
      </div>
      <Skeleton className="h-20 rounded-md" />
      <Skeleton className="h-20 rounded-md" />
      <Skeleton className="h-20 rounded-md" />
    </div>
  );
}

export function BuyerCheckoutSkeleton() {
  return (
    <div className="mx-auto max-w-2xl space-y-4" aria-busy="true">
      <Skeleton className="h-40 rounded-md" />
      <Skeleton className="h-40 rounded-md" />
      <Skeleton className="h-12 w-full rounded-md" />
    </div>
  );
}
