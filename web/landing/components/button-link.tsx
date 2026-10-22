import Link from "next/link";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "inverse";
type Size = "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand shadow-sm hover:bg-brand-hover",
  secondary: "border border-line bg-surface text-ink hover:border-ink-muted/40 hover:bg-surface-muted",
  ghost: "text-ink hover:bg-surface-muted",
  inverse: "bg-white text-[#1f52bd] shadow-sm hover:bg-white/90",
};

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

/**
 * A link that looks like a button — every call to action on the site is a
 * navigation, never a form submit. External links (the web app, a store
 * listing) render a plain anchor; internal ones go through `next/link`.
 */
export function ButtonLink({
  href,
  children,
  variant = "primary",
  size = "md",
  className = "",
  external,
}: {
  href: string;
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  className?: string;
  external?: boolean;
}) {
  const classes = `inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${variants[variant]} ${sizes[size]} ${className}`;
  const isExternal = external ?? /^https?:\/\//.test(href);

  if (isExternal) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}
