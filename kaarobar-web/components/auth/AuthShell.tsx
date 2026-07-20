import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  BookOpenCheck,
  ShieldCheck,
} from "lucide-react";

import { routes } from "@/lib/navigation";

const highlights = [
  {
    icon: Boxes,
    title: "Several businesses, one login",
    description: "Owner, business, and branch are built in from the start—not bolted on later.",
  },
  {
    icon: BookOpenCheck,
    title: "Real double-entry books",
    description: "Sales and payroll post balanced journals for you.",
  },
  {
    icon: BarChart3,
    title: "See every shop",
    description: "Sales, cash, stock, and staff across all your locations.",
  },
];

interface AuthShellProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  badge: string;
  footer: React.ReactNode;
}

export default function AuthShell({
  children,
  title,
  subtitle,
  badge,
  footer,
}: AuthShellProps) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.35),transparent_55%)]" />
        <div className="relative">
          <Link href={routes.home} className="inline-flex items-center gap-2 text-sm text-sidebar-muted hover:text-white">
            <ArrowLeft size={16} />
            Back to home
          </Link>
          <div className="mt-10">
            <p className="text-2xl font-bold text-white">Kaarobar</p>
            <p className="mt-1 text-xs text-sidebar-muted">
              POS · Accounting · Payroll
            </p>
          </div>
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand/30 px-3 py-1 text-xs font-semibold text-brand-muted">
              <ShieldCheck size={14} />
              Built for Pakistan · Multi-branch
            </div>
            <p className="mt-4 text-lg font-semibold text-white">
              Everything under one owner account
            </p>
            <p className="mt-2 text-sm leading-6 text-sidebar-muted">
              POS, stock, proper books, and payroll—with shops that can work on
              their own while you still see the full picture.
            </p>
          </div>
        </div>

        <ul className="relative mt-12 space-y-5">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-brand-muted">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-sidebar-muted">{item.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="flex flex-col justify-center bg-bg-primary px-6 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href={routes.home} className="text-sm font-semibold text-brand">
              ← Kaarobar
            </Link>
          </div>
          <p className="text-sm font-semibold text-brand">{badge}</p>
          <h1 className="mt-2 text-3xl font-bold text-heading">{title}</h1>
          <p className="mt-2 text-body">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-body">{footer}</p>
        </div>
      </main>
    </div>
  );
}
