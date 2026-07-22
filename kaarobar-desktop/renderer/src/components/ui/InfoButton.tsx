"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import Modal from "@/components/modals/Modal";
import Button from "@/components/ui/Button";
import { getHelpTopic, type HelpTopic } from "@/lib/help";
import { useI18n, useT } from "@/lib/i18n";

type InfoButtonProps = {
  topicId: string;
  className?: string;
  /** Visual size of the icon button */
  size?: "sm" | "md";
  /** Accessible / tooltip label override */
  label?: string;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-brand">{title}</h3>
      <div className="text-sm leading-relaxed text-body">{children}</div>
    </section>
  );
}

export function FeatureInfoModal({
  isOpen,
  onClose,
  topic,
}: {
  isOpen: boolean;
  onClose: () => void;
  topic: HelpTopic;
}) {
  const t = useT();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={topic.title}
      description={topic.summary}
      size="lg"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>{t("help.gotIt")}</Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Section title={t("help.what")}>
          <p>{topic.what}</p>
        </Section>
        <Section title={t("help.how")}>
          <ol className="list-decimal space-y-1.5 ps-5">
            {topic.how.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Section>
        <Section title={t("help.when")}>
          <p>{topic.when}</p>
        </Section>
        {topic.tips?.length ? (
          <Section title={t("help.tips")}>
            <ul className="list-disc space-y-1.5 ps-5">
              {topic.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </Modal>
  );
}

/** Circular (i) control that opens localized feature help. */
export default function InfoButton({
  topicId,
  className = "",
  size = "sm",
  label,
}: InfoButtonProps) {
  const t = useT();
  const { locale } = useI18n();
  const [open, setOpen] = useState(false);
  const topic = getHelpTopic(locale, topicId);
  if (!topic) return null;

  const aria = label || t("help.aboutThis");
  const dim = size === "md" ? "h-8 w-8" : "h-6 w-6";
  const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <>
      <button
        type="button"
        aria-label={aria}
        title={aria}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted transition hover:border-brand/40 hover:bg-brand-light hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${dim} ${className}`}
      >
        <Info className={icon} strokeWidth={2.25} aria-hidden />
      </button>
      <FeatureInfoModal isOpen={open} onClose={() => setOpen(false)} topic={topic} />
    </>
  );
}
