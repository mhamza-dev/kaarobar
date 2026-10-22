import { ChevronDown } from "lucide-react";

import type { Faq } from "@/lib/content";

/** Native disclosure widgets: keyboard- and screen-reader-ready with no script. */
export function FaqList({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="mx-auto max-w-3xl divide-y divide-line rounded-2xl border border-line bg-surface">
      {faqs.map((faq) => (
        <details key={faq.question} className="group px-5 py-4 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left font-medium text-ink [&::-webkit-details-marker]:hidden">
            {faq.question}
            <ChevronDown
              className="size-5 shrink-0 text-ink-muted transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="mt-3 text-ink-muted">{faq.answer}</p>
        </details>
      ))}
    </div>
  );
}
