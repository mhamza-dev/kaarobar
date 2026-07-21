import type { LegalSection } from "@/lib/legal/content";

type LegalSectionsProps = {
  sections: LegalSection[];
  compact?: boolean;
};

export default function LegalSections({
  sections,
  compact = false,
}: LegalSectionsProps) {
  return (
    <div className={compact ? "space-y-6 text-sm leading-7 text-body" : "space-y-8"}>
      {sections.map((section) => (
        <section key={section.id}>
          <h3
            className={
              compact
                ? "mb-2 text-lg font-semibold text-heading"
                : "text-xl font-semibold text-heading"
            }
          >
            {section.title}
          </h3>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className={compact ? "mt-2" : "mt-3"}>
              {paragraph}
            </p>
          ))}
          {section.bullets ? (
            <ul className={`list-disc space-y-2 pl-5 ${compact ? "mt-2" : "mt-3"}`}>
              {section.bullets.map((item) => (
                <li key={item.slice(0, 40)}>{item}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ))}
    </div>
  );
}
