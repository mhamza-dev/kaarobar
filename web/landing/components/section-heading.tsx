import type { ReactNode } from "react";

export function SectionHeading({
  eyebrow,
  title,
  children,
  align = "center",
  id,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  align?: "center" | "left";
  id?: string;
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      {eyebrow && (
        <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold tracking-wide text-brand-ink uppercase">
          {eyebrow}
        </p>
      )}
      <h2 id={id} className="mt-4 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl lg:text-[2.75rem] lg:leading-tight">
        {title}
      </h2>
      {children && <p className="mt-4 text-lg text-pretty text-ink-muted">{children}</p>}
    </div>
  );
}

/** The heading block at the top of an inner page. */
export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <p className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold tracking-wide text-brand-ink uppercase">
        {eyebrow}
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl lg:text-6xl">
        {title}
      </h1>
      {children && <p className="mt-5 text-lg text-pretty text-ink-muted sm:text-xl">{children}</p>}
    </div>
  );
}

/**
 * The hero's soft brand glow and faint grid, behind an inner page's intro —
 * so every page opens the way the home page does. The section it sits in
 * needs `relative isolate overflow-hidden`.
 */
export function IntroBackdrop() {
  return (
    <>
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(55%_60%_at_50%_0%,var(--brand-tint),transparent_75%)]"
      />
      <div aria-hidden="true" className="bg-grid absolute inset-0 -z-10" />
    </>
  );
}
