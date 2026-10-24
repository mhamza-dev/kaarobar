import { initials, swatchFor } from "@/lib/initials";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-7 text-[0.688rem]",
  md: "size-9 text-xs",
  lg: "size-12 text-base",
} as const;

/**
 * A person or thing shown by its initials on its own colour — customers,
 * suppliers and products rarely have a picture, and a column of names
 * scans faster with a face beside each.
 */
export function InitialsAvatar({
  name,
  size = "md",
  shape = "circle",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  shape?: "circle" | "square";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center font-semibold select-none",
        shape === "circle" ? "rounded-full" : "rounded-lg",
        SIZES[size],
        swatchFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
