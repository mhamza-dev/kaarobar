import Link from "next/link";

import type { LegalSection } from "@/lib/legal/content";
import { LEGAL_CONTACT_EMAIL, LEGAL_EFFECTIVE_DATE } from "@/lib/legal/content";
import { routes } from "@/lib/navigation";

type LegalDocumentProps = {
  title: string;
  description?: string;
  sections: LegalSection[];
};

export default function LegalDocument({
  title,
  description,
  sections,
}: LegalDocumentProps) {
  return (
    <section className="bg-bg-primary py-20">
      <div className="mx-auto max-w-3xl px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-brand">
          Legal
        </p>
        <h1 className="mt-3 text-4xl font-bold text-heading">{title}</h1>
        {description ? (
          <p className="mt-4 text-lg leading-8 text-body">{description}</p>
        ) : null}
        <p className="mt-4 text-body">
          Last updated: {LEGAL_EFFECTIVE_DATE}
        </p>

        <div className="mt-10 space-y-8 text-body leading-8">
          {sections.map((section) => (
            <section key={section.id} id={section.id}>
              <h2 className="text-xl font-semibold text-heading">
                {section.title}
              </h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 48)} className="mt-3">
                  {renderInline(paragraph)}
                </p>
              ))}
              {section.bullets ? (
                <ul className="mt-3 list-disc space-y-2 pl-5">
                  {section.bullets.map((item) => (
                    <li key={item.slice(0, 48)}>{renderInline(item)}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <p className="mt-12 text-sm text-muted">
          Related:{" "}
          <Link href={routes.privacy} className="text-brand hover:underline">
            Privacy Policy
          </Link>
          {" · "}
          <Link href={routes.terms} className="text-brand hover:underline">
            Terms & Conditions
          </Link>
          {" · "}
          <Link href={routes.cookies} className="text-brand hover:underline">
            Cookie Policy
          </Link>
          {" · "}
          <Link href={routes.contact} className="text-brand hover:underline">
            Contact
          </Link>
          {" · "}
          <a
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
            className="text-brand hover:underline"
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </section>
  );
}

function renderInline(text: string) {
  const email = LEGAL_CONTACT_EMAIL;
  if (!text.includes(email) && !text.includes("Contact page")) {
    return text;
  }

  const parts = text.split(new RegExp(`(${email}|Contact page)`, "g"));
  return parts.map((part, index) => {
    if (part === email) {
      return (
        <a
          key={`${part}-${index}`}
          href={`mailto:${email}`}
          className="font-medium text-brand hover:underline"
        >
          {email}
        </a>
      );
    }
    if (part === "Contact page") {
      return (
        <Link
          key={`${part}-${index}`}
          href={routes.contact}
          className="font-medium text-brand hover:underline"
        >
          Contact page
        </Link>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}
