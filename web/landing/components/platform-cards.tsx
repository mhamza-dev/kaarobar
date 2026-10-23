import { Globe, Laptop, Smartphone, type LucideIcon } from "lucide-react";

import { ButtonLink } from "@/components/button-link";
import { site } from "@/lib/site";

type Platform = {
  icon: LucideIcon;
  title: string;
  detail: string;
  actions: Array<{ label: string; href: string | null }>;
};

const platforms: Platform[] = [
  {
    icon: Globe,
    title: "Web app",
    detail: "Run the till and the back office from any modern browser — nothing to install.",
    actions: [{ label: "Open the web app", href: `${site.appUrl}/login` }],
  },
  {
    icon: Laptop,
    title: "Desktop app",
    detail: "A dedicated till for Windows and macOS, made for receipt printers and cash drawers.",
    actions: [
      { label: "Windows", href: site.downloads.windows },
      { label: "macOS", href: site.downloads.mac },
    ],
  },
  {
    icon: Smartphone,
    title: "Mobile app",
    detail: "Sell, check stock and see today's takings from your phone, wherever you are.",
    actions: [
      { label: "App Store", href: site.downloads.ios },
      { label: "Google Play", href: site.downloads.android },
    ],
  },
];

/**
 * Web, desktop and mobile — one account, one subscription. A store link
 * that isn't published yet reads "coming soon" instead of linking nowhere.
 */
export function PlatformCards({
  detailed = false,
  inverse = false,
}: {
  detailed?: boolean;
  /** White-on-blue, for the deep brand band. */
  inverse?: boolean;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {platforms.map((platform) => {
        const live = platform.actions.filter((action) => action.href);
        return (
          <div
            key={platform.title}
            className={
              inverse
                ? "flex flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-6 backdrop-blur-sm"
                : "flex flex-col rounded-2xl border border-line bg-surface p-6"
            }
          >
            <span
              className={`flex size-11 items-center justify-center rounded-xl ${
                inverse ? "bg-white/15 text-white ring-1 ring-white/20" : "bg-brand-tint text-brand-ink"
              }`}
            >
              <platform.icon className="size-5" aria-hidden />
            </span>
            <h3 className={`mt-5 text-lg font-semibold ${inverse ? "text-white" : "text-ink"}`}>
              {platform.title}
            </h3>
            <p className={`mt-2 ${inverse ? "text-white/80" : "text-ink-muted"}`}>{platform.detail}</p>
            {detailed && (
              <div className="mt-6 flex flex-wrap items-center gap-2">
                {live.map((action) => (
                  <ButtonLink key={action.label} href={action.href!} variant="secondary">
                    {action.label}
                  </ButtonLink>
                ))}
                {live.length === 0 && (
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-sm font-medium text-ink-muted">
                    Coming soon
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
