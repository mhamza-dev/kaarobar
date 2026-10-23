import type { Metadata } from "next";
import { LifeBuoy, Mail, MessageCircle, Store } from "lucide-react";

import { ButtonLink } from "@/components/button-link";
import { Container } from "@/components/container";
import { FaqList } from "@/components/faq-list";
import { IntroBackdrop, PageIntro, SectionHeading } from "@/components/section-heading";
import { generalFaqs } from "@/lib/content";
import { site, whatsappUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Talk to the Kaarobar team about sales, setting up, or support.",
  alternates: { canonical: "/contact" },
};

function mailto(subject: string) {
  return `mailto:${site.contactEmail}?subject=${encodeURIComponent(subject)}`;
}

const channels = [
  {
    icon: Store,
    title: "Sales",
    detail: "Want to know if Kaarobar suits your business, or need more than a plan offers? Tell us about it.",
    action: { label: "Email sales", href: mailto("Sales enquiry") },
  },
  {
    icon: LifeBuoy,
    title: "Support",
    detail: "Already using Kaarobar and something isn't right? Include your business name and what you saw.",
    action: { label: "Email support", href: mailto("Support request") },
  },
  {
    icon: Mail,
    title: "Everything else",
    detail: "Partnerships, press, or anything that doesn't fit above.",
    action: { label: site.contactEmail, href: `mailto:${site.contactEmail}` },
  },
];

export default function ContactPage() {
  const whatsapp = whatsappUrl();

  return (
    <>
      <section className="relative isolate overflow-hidden py-16 sm:py-24">
        <IntroBackdrop />
        <Container>
          <PageIntro eyebrow="Contact" title="We'd love to hear from you">
            Tell us what you need and a person will get back to you.
          </PageIntro>
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {channels.map((channel) => (
              <div key={channel.title} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
                <channel.icon className="size-6 text-brand-ink" aria-hidden />
                <h2 className="mt-4 text-lg font-semibold text-ink">{channel.title}</h2>
                <p className="mt-2 flex-1 text-ink-muted">{channel.detail}</p>
                <ButtonLink href={channel.action.href} variant="secondary" className="mt-6" external>
                  {channel.action.label}
                </ButtonLink>
              </div>
            ))}
          </div>
          {whatsapp && (
            <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-line bg-surface-muted p-6 sm:flex-row">
              <p className="flex items-center gap-3 text-ink">
                <MessageCircle className="size-6 text-success" aria-hidden />
                Prefer WhatsApp? Message us and we&apos;ll reply there.
              </p>
              <ButtonLink href={whatsapp} external>
                Chat on WhatsApp
              </ButtonLink>
            </div>
          )}
        </Container>
      </section>

      <section aria-labelledby="contact-faq-heading" className="border-t border-line bg-surface-muted py-16 sm:py-24">
        <Container>
          <SectionHeading id="contact-faq-heading" title="You might find your answer here" />
          <div className="mt-12">
            <FaqList faqs={generalFaqs} />
          </div>
        </Container>
      </section>
    </>
  );
}
