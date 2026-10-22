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
        <p className="text-sm font-semibold tracking-wide text-brand-ink uppercase">{eyebrow}</p>
      )}
      <h2 id={id} className="mt-2 text-3xl font-semibold tracking-tight text-balance text-ink sm:text-4xl">
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
      <p className="text-sm font-semibold tracking-wide text-brand-ink uppercase">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance text-ink sm:text-5xl">
        {title}
      </h1>
      {children && <p className="mt-5 text-lg text-pretty text-ink-muted sm:text-xl">{children}</p>}
    </div>
  );
}
