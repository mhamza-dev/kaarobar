import type { Metadata } from "next";
import { ArrowRight, KeyRound, RefreshCw, Users } from "lucide-react";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { PlatformCards } from "@/components/platform-cards";
import { IntroBackdrop, PageIntro } from "@/components/section-heading";
import { signInUrl, signUpUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Download",
  description: "Use Kaarobar on the web, on Windows and macOS, and on iPhone and Android — one account and one subscription.",
  alternates: { canonical: "/download" },
};

const notes = [
  {
    icon: KeyRound,
    title: "One sign-in everywhere",
    detail: "Use the same email and password on every app. Two-step sign-in follows you too.",
  },
  {
    icon: RefreshCw,
    title: "Always in sync",
    detail: "A sale on the till shows up on your phone straight away — every app works from the same live data.",
  },
  {
    icon: Users,
    title: "Each person sees their own",
    detail: "Staff get the screens their role allows, on whichever device they use.",
  },
];

export default function DownloadPage() {
  return (
    <>
      <section className="relative isolate overflow-hidden py-16 sm:py-24">
        <IntroBackdrop />
        <Container>
          <PageIntro eyebrow="Download" title="Kaarobar, on every device you use">
            Your subscription includes every app. Start on the web today — there&apos;s nothing to install —
            and add the desktop till or your phone whenever you like.
          </PageIntro>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <ButtonLink href={signUpUrl()} size="lg">
              Start free trial <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink href={signInUrl()} variant="secondary" size="lg">
              Sign in to the web app
            </ButtonLink>
          </div>
          <div className="mt-16">
            <PlatformCards detailed />
          </div>
        </Container>
      </section>

      <section aria-labelledby="sync-heading" className="border-t border-line bg-surface-muted py-16 sm:py-20">
        <Container>
          <h2 id="sync-heading" className="sr-only">
            How the apps work together
          </h2>
          <div className="grid gap-8 md:grid-cols-3">
            {notes.map((note) => (
              <div key={note.title}>
                <note.icon className="size-6 text-brand-ink" aria-hidden />
                <h3 className="mt-4 font-semibold text-ink">{note.title}</h3>
                <p className="mt-2 text-ink-muted">{note.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-12 text-center text-sm text-ink-muted">
            The apps need an internet connection. The web app runs in current versions of Chrome, Edge, Safari
            and Firefox.
          </p>
        </Container>
      </section>
    </>
  );
}
