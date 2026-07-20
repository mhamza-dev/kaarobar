"use client";

import Link from "next/link";

export default function HrPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HR & Payroll</h1>
        <p className="text-[#4A5A52]">
          Employees, attendance, leave, and payroll runs that post to the ledger.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            title: "Employees",
            body: "Master records and compensation structure.",
            href: "/app/hr#employees",
          },
          {
            title: "Attendance & Leave",
            body: "Clock-in from POS/mobile and approval workflows.",
            href: "/app/hr#attendance",
          },
          {
            title: "Payroll",
            body: "Draft → approve → post consolidated journal + payslips.",
            href: "/app/hr#payroll",
          },
        ].map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-xl border border-[#D9D3C7] bg-white p-4 hover:border-[#2F6F4E]"
          >
            <h2 className="font-semibold">{card.title}</h2>
            <p className="mt-2 text-sm text-[#4A5A52]">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
