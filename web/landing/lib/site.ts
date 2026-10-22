/**
 * Where everything lives. Read once, here, so a page never builds a link to
 * the app or a store listing by hand.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so each must be read by
 * its literal name — `process.env[name]` would come back undefined in the
 * browser bundle.
 */

function optional(value: string | undefined): string | null {
  return value && value.trim() !== "" ? value.trim() : null;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export const site = {
  name: "Kaarobar",
  tagline: "Run your whole business from one place.",
  description:
    "Kaarobar is point of sale, stock, purchasing, customers and reports for shops, restaurants, salons and service businesses — on the web, your desktop and your phone.",
  url: trimSlash(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3001"),
  appUrl: trimSlash(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? "hello@kaarobar.app",
  whatsappNumber: optional(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
  downloads: {
    windows: optional(process.env.NEXT_PUBLIC_DESKTOP_WINDOWS_URL),
    mac: optional(process.env.NEXT_PUBLIC_DESKTOP_MAC_URL),
    ios: optional(process.env.NEXT_PUBLIC_IOS_APP_URL),
    android: optional(process.env.NEXT_PUBLIC_ANDROID_APP_URL),
  },
} as const;

/** The web app's sign-up, optionally with a plan already chosen. */
export function signUpUrl(plan?: string): string {
  return plan ? `${site.appUrl}/register?plan=${encodeURIComponent(plan)}` : `${site.appUrl}/register`;
}

export const signInUrl = () => `${site.appUrl}/login`;

export const whatsappUrl = () =>
  site.whatsappNumber ? `https://wa.me/${site.whatsappNumber.replace(/\D/g, "")}` : null;

export const navigation = [
  { label: "Features", href: "/features" },
  { label: "Industries", href: "/industries" },
  { label: "Pricing", href: "/pricing" },
  { label: "Download", href: "/download" },
  { label: "About", href: "/about" },
] as const;
