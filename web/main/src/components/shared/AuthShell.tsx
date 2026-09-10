import type { ReactNode } from "react";

/** The shell every pre-login screen (login, register, password reset) renders inside. */
export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground shadow-soft">
            K
          </div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-soft">{children}</div>
      </div>
    </div>
  );
}
