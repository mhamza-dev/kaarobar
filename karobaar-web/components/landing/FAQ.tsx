"use client";

import { useState } from "react";
import { ArrowRight, ChevronDown } from "lucide-react";

import Link from "@/components/ui/Link";
import { routes } from "@/lib/navigation";

const faqs = [
  {
    question: "What is Kaarobar?",
    answer:
      "Kaarobar is an AI-powered Business Operating System that combines POS, Inventory, Accounting, HR, Payroll, CRM, Reporting, and Business Analytics into one unified cloud platform.",
  },
  {
    question: "Can I manage multiple businesses?",
    answer:
      "Yes. Kaarobar allows you to manage multiple businesses, branches, warehouses, and teams from a single account while keeping each business completely isolated and secure.",
  },
  {
    question: "Can I migrate my existing data?",
    answer:
      "Absolutely. You can import products, customers, suppliers, inventory, and other business records from Excel or CSV files, making migration simple and fast.",
  },
  {
    question: "Does Kaarobar support barcode scanners and receipt printers?",
    answer:
      "Yes. Kaarobar is designed to work with common barcode scanners, receipt printers, and other POS hardware for smooth daily operations.",
  },
  {
    question: "Is my business data secure?",
    answer:
      "Security is one of our highest priorities. All communication is encrypted using HTTPS, data is protected with role-based permissions, regular backups, audit logs, and enterprise-grade security practices.",
  },
  {
    question: "Can my employees have separate accounts?",
    answer:
      "Yes. Every employee can have their own secure login with customizable roles and permissions, ensuring they only access the modules and data relevant to their responsibilities.",
  },
  {
    question: "Is Kaarobar cloud-based?",
    answer:
      "Yes. Your business data is securely stored in the cloud, allowing you to access your dashboard anytime from desktop, tablet, or mobile devices.",
  },
  {
    question: "Does Kaarobar include AI features?",
    answer:
      "Yes. Kaarobar includes an AI Assistant that helps you analyze sales, inventory, expenses, employee performance, and other business metrics through natural language conversations.",
  },
  {
    question: "Can I upgrade my subscription later?",
    answer:
      "Of course. You can upgrade or change your subscription plan whenever your business grows without losing any of your data.",
  },
  {
    question: "Do you provide customer support?",
    answer:
      "Yes. We provide documentation, email support, and priority assistance depending on your subscription plan. Enterprise customers also receive dedicated onboarding and account management.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number>(0);

  return (
    <section id="faq" className="bg-bg-primary py-28">
      <div className="mx-auto max-w-4xl px-6">
        <div className="text-center">
          <span className="rounded-full bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
            Frequently Asked Questions
          </span>

          <h2 className="mt-6 text-5xl font-bold text-heading">
            Everything You Need to Know
          </h2>

          <p className="mt-6 text-lg leading-8 text-body">
            Have questions? Here are the answers to the most common ones about
            Kaarobar.
          </p>
        </div>

        <div className="mt-16 space-y-5">
          {faqs.map((faq, index) => {
            const isOpen = open === index;

            return (
              <div
                key={faq.question}
                className="
                  overflow-hidden
                  rounded-2xl
                  border
                  border-border
                  bg-card
                  transition-all
                  duration-300
                "
              >
                <button
                  onClick={() => setOpen(isOpen ? -1 : index)}
                  className="
                    flex
                    w-full
                    items-center
                    justify-between
                    p-6
                    text-left
                    transition-colors
                    hover:bg-bg-hover
                  "
                >
                  <h3 className="pr-6 text-lg font-semibold text-heading">
                    {faq.question}
                  </h3>

                  <ChevronDown
                    className={`
                      h-5
                      w-5
                      shrink-0
                      text-brand
                      transition-transform
                      duration-300

                      ${isOpen ? "rotate-180" : ""}
                    `}
                  />
                </button>

                <div
                  className={`
                    grid
                    transition-all
                    duration-300

                    ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}
                  `}
                >
                  <div className="overflow-hidden">
                    <p className="px-6 pb-6 leading-8 text-body">
                      {faq.answer}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}

        <div className="mt-20 rounded-3xl border border-brand/20 bg-brand-soft p-10 text-center">
          <h3 className="text-3xl font-bold text-heading">
            Still have questions?
          </h3>

          <p className="mt-4 text-lg text-body">
            Our team is here to help you choose the right solution for your
            business.
          </p>

          <Link
            href={routes.contact}
            variant="primary"
            size="lg"
            className="mt-8"
            endIcon={<ArrowRight size={18} />}
          >
            Contact Our Team
          </Link>
        </div>
      </div>
    </section>
  );
}
