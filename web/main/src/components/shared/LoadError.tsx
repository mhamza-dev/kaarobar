import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * A section whose request failed — for screens not built on `DataTable`
 * (which has its own `error` state). Never fall through to the empty
 * state instead: "no subscription" or "no sales" is a claim, and a failed
 * request can't back it up.
 */
export function LoadError({
  what,
  onRetry,
  className,
}: {
  /** What didn't load, as it would finish "Couldn't load …". */
  what: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-2 py-6 text-center", className)}
    >
      <p className="text-sm text-muted-foreground">Couldn&apos;t load {what}.</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
