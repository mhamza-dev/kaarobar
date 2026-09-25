import { Skeleton } from "@/components/ui/skeleton";

/** What a detail page shows while its record loads: a few bars, no layout jump. */
export function DetailSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {Array.from({ length: rows }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </div>
  );
}
