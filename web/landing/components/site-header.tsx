import Link from "next/link";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { Logo } from "@/components/logo";
import { MobileNav } from "@/components/mobile-nav";
import { NavLinks } from "@/components/nav-links";
import { signInUrl, signUpUrl } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/85 backdrop-blur supports-[backdrop-filter]:bg-canvas/70">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand focus:px-3 focus:py-2 focus:text-on-brand"
      >
        Skip to content
      </a>
      <Container className="relative flex h-16 items-center justify-between gap-6">
        <Link href="/" aria-label="Kaarobar home" className="shrink-0">
          <Logo />
        </Link>
        <NavLinks />
        <div className="hidden items-center gap-2 md:flex">
          <ButtonLink href={signInUrl()} variant="ghost">
            Sign in
          </ButtonLink>
          <ButtonLink href={signUpUrl()}>Start free trial</ButtonLink>
        </div>
        <MobileNav />
      </Container>
    </header>
  );
}
