"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";

import Link from "@/components/ui/Link";
import { routes } from "@/lib/navigation";

const faqs = [
  {
    question: "What is Kaarobar?",
    answer:
      "Kaarobar is software for owners who run more than one business—and often more than one branch in each. You get a till, stock, proper double-entry books, and HR/payroll in one place. Sales and payroll post into the ledger so you’re not retyping numbers at night.",
  },
  {
    question: "How do multiple businesses and branches work?",
    answer:
      "Your owner login can hold many businesses. Each business has its own books and branches. You give staff access to the shops they work in—or wider access if they manage the whole company.",
  },
  {
    question: "Does the POS work offline?",
    answer:
      "Yes. The desktop till keeps a local copy of the catalog and stock, takes sales while you’re offline, and sends them up when the connection returns—without creating duplicates. It’s built for outages that last hours, not just a few seconds.",
  },
  {
    question: "Is the accounting real double-entry?",
    answer:
      "Yes. Sales, returns, goods receipts, and approved payroll create balanced journals. Once something is posted, you don’t silently edit it—you reverse it properly so the history stays clean.",
  },
  {
    question: "Do you support Pakistan FBR Tier-1?",
    answer:
      "Yes. If a business needs Tier-1 reporting, we send sales to FBR in the background and put the invoice number and QR on the receipt when they come back. The cashier doesn’t wait on FBR to finish the sale.",
  },
  {
    question: "What hardware does the POS support?",
    answer:
      "Common thermal printers (USB or network), USB barcode scanners, and cash drawers that open through the printer. There’s also a lighter browser till if you don’t need the full desktop setup.",
  },
  {
    question: "Who is the mobile app for?",
    answer:
      "Owners and managers use it for dashboards and approvals. Staff use it to clock in, request leave, and view payslips.",
  },
  {
    question: "What isn’t included yet?",
    answer:
      "We’re not building customer-facing online shops, full factory BOM planning, biometric clocks, multi-currency group consolidation, or fancy forecasting in the first release. Those can come later without rebuilding the core.",
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
            Questions we hear a lot
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
            Still stuck? Talk to us
          </Link>
        </div>
      </div>
    </section>
  );
}
