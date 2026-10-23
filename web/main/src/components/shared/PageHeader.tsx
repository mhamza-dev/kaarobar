import type { ReactNode } from "react";

import { PageActionsSlot } from "./PageActions";

/** Title/description/actions slot every authenticated screen opens with. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 pb-6 md:pb-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-primary" />
            <span className="truncate">{eyebrow}</span>
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-[1.75rem]">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground md:text-[0.938rem]">
            {description}
          </p>
        )}
      </div>
      <PageActionsSlot>{actions}</PageActionsSlot>
    </div>
  );
}
