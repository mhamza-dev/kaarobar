import Link from "next/link";

import { Container } from "@/components/container";
import { Logo } from "@/components/logo";
import { signInUrl, signUpUrl, site } from "@/lib/site";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Industries", href: "/industries" },
      { label: "Pricing", href: "/pricing" },
      { label: "Download", href: "/download" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface-muted">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-xs text-sm text-ink-muted">{site.tagline}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a href={signUpUrl()} className="font-medium text-brand-ink hover:underline">
              Start free trial
            </a>
            <a href={signInUrl()} className="font-medium text-ink-muted hover:text-ink">
              Sign in
            </a>
          </div>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h2 className="text-sm font-semibold text-ink">{column.title}</h2>
            <ul className="mt-3 flex flex-col gap-2 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-ink-muted hover:text-ink">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Container>
      <div className="border-t border-line">
        <Container className="flex flex-col gap-2 py-6 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Kaarobar. All rights reserved.</p>
          <a href={`mailto:${site.contactEmail}`} className="hover:text-ink">
            {site.contactEmail}
          </a>
        </Container>
      </div>
    </footer>
  );
}
