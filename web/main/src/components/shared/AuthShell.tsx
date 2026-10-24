import { BarChart3, Boxes, ScanLine } from "lucide-react";
import type { ReactNode } from "react";

import { LogoMark } from "@/components/shared/LogoMark";

/** What the side panel says Kaarobar does — the same claims as web/landing. */
const HIGHLIGHTS = [
  {
    icon: ScanLine,
    title: "A till that keeps up with a queue",
    body: "Scan, search or tap, then take payment however the customer pays.",
  },
  {
    icon: Boxes,
    title: "Stock you can trust",
    body: "What you have in every branch, and why every number is what it is.",
  },
  {
    icon: BarChart3,
    title: "The numbers an owner looks at",
    body: "Today's sales, best sellers and the books, without a spreadsheet.",
  },
];

/**
 * The shell every pre-login screen (login, register, password reset)
 * renders inside: the form on the right, and on wide screens a panel on the
 * left saying what Kaarobar is. The panel is always Kaarobar blue — no
 * business, so no business brand, has been chosen yet.
 */
export function AuthShell({
  title,
  documentTitle,
  description,
  children,
}: {
  title: string;
  /** The browser tab's name, when the heading is a greeting ("Welcome back"). */
  documentTitle?: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <title>{`${documentTitle ?? title} · Kaarobar`}</title>
      <aside className="relative hidden overflow-hidden bg-[#173c9f] text-white lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Light from the top corner and a faint grid — depth without an image.
            Text is checked against the lightest point: white/80 is 4.8:1. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_0%_0%,rgb(59_130_246/0.4)_0%,transparent_55%),radial-gradient(90%_70%_at_100%_100%,#13307f_0%,transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_85%)] bg-[linear-gradient(rgb(255_255_255/0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.06)_1px,transparent_1px)] bg-[size:44px_44px]"
        />

        <div className="relative flex items-center gap-3">
          <LogoMark className="size-10 rounded-[0.6rem] ring-1 ring-white/25" />
          <span className="text-xl font-semibold tracking-tight">Kaarobar</span>
        </div>

        <div className="relative flex max-w-md flex-col gap-10">
          <div className="flex flex-col gap-3">
            <p className="text-3xl leading-tight font-semibold tracking-tight xl:text-4xl">
              Run your whole shop from one place.
            </p>
            <p className="text-base text-white/85">
              From the counter to the books — on the web, the desktop and your phone.
            </p>
          </div>
          <ul className="flex flex-col gap-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item.title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/12 ring-1 ring-white/20 backdrop-blur">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="font-semibold">{item.title}</p>
                  <p className="text-sm text-white/80">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/80">
          One account for every branch, business and device.
        </p>
      </aside>

      <main className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col gap-2">
            <LogoMark className="mb-4 size-11 lg:hidden" />
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
