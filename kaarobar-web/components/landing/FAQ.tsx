"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";

import Link from "@/components/ui/Link";
import { routes } from "@/lib/navigation";

const faqs = [
  {
    question: "What is Kaarobar?",
    answer:
      "Kaarobar is a cloud POS, Accounting, and HR platform for owners who operate multiple businesses, each with multiple branches. Sales, stock, and payroll post into a proper double-entry ledger automatically.",
  },
  {
    question: "How does multi-business / multi-branch work?",
    answer:
      "Your owner account can hold many businesses. Each business has its own chart of accounts and branches. Staff are assigned roles scoped to specific branches or business-wide access.",
  },
  {
    question: "Does the POS work offline?",
    answer:
      "Yes. The Electron desktop POS caches the branch catalog and stock snapshot, queues sales with client-generated transaction IDs, and syncs idempotently when connectivity returns—designed for hours-to-a-day outages.",
  },
  {
    question: "Is accounting real double-entry or just a cash log?",
    answer:
      "Real double-entry. Completed sales, returns, GRNs, and approved payroll runs generate balanced journal entries. Posted entries are immutable; corrections use reversing entries.",
  },
  {
    question: "Do you support Pakistan FBR Tier-1 POS integration?",
    answer:
      "Yes. Businesses flagged as Tier-1 can report sales asynchronously to FBR and embed the returned invoice number and QR on receipts without blocking checkout.",
  },
  {
    question: "What hardware does the POS support?",
    answer:
      "ESC/POS thermal printers (USB/LAN), USB-HID barcode scanners, and cash drawers triggered via the printer—plus a browser POS mode for lighter hardware.",
  },
  {
    question: "Who can use the mobile app?",
    answer:
      "Owners and managers for dashboards and approvals, and employees for self-service: clock-in/out, leave requests, and payslips.",
  },
  {
    question: "What is out of scope for Release 1.0?",
    answer:
      "Customer-facing e-commerce, full manufacturing BOM planning, biometric attendance hardware, multi-currency consolidation, and advanced predictive BI are deferred beyond v1.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number>(0);

  return (
    <section id="faq" className="bg-bg-secondary py-28">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center">
          <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            FAQ
          </span>
          <h2 className="mt-6 text-4xl font-bold text-heading md:text-5xl">
            Answers aligned to how Kaarobar is built
          </h2>
        </div>

        <div className="mt-16 space-y-4">
          {faqs.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div
                key={faq.question}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                  onClick={() => setOpen(isOpen ? -1 : index)}
                >
                  <span className="font-semibold text-heading">{faq.question}</span>
                  <ChevronDown
                    className={`shrink-0 text-brand transition ${isOpen ? "rotate-180" : ""}`}
                    size={20}
                  />
                </button>
                {isOpen ? (
                  <p className="border-t border-border px-6 py-5 text-body leading-7">
                    {faq.answer}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link href={routes.contact} variant="outline" endIcon={<ArrowRight size={16} />}>
            Still have questions? Contact us
          </Link>
        </div>
      </div>
    </section>
  );
}
