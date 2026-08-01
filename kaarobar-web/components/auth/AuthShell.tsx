"use client";

import Link from "next/link";
import {
  BarChart3,
  Boxes,
  BookOpenCheck,
  ShieldCheck,
} from "lucide-react";

import { routes } from "@/lib/navigation";
import KaarobarLogo from "@/components/brand/KaarobarLogo";
import { useT } from "@/lib/i18n";

const highlights = [
  {
    icon: Boxes,
    title: "Several businesses, one login",
    description: "Pick the shop and branch you need. Access stays scoped to your role.",
  },
  {
    icon: BookOpenCheck,
    title: "Real double-entry books",
    description: "Sales and payroll post balanced journals so your ledger stays honest.",
  },
  {
    icon: BarChart3,
    title: "See every shop",
    description: "Sales, cash, stock, and staff across the locations you manage.",
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
  const t = useT();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(29,78,216,0.35),transparent_55%)]" />
        <div className="relative">
          <Link href={routes.login} className="inline-flex items-center gap-3">
            <KaarobarLogo size={48} className="shrink-0 rounded-md shadow-brand" />
            <div>
              <p className="text-2xl font-bold text-white">{t("common.appName")}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                A product of 2ndHub Solutions
              </p>
            </div>
          </Link>
          {/* Avoid .glass-panel here: it is a light surface and kills contrast on the dark rail */}
          <div className="mt-10 rounded-md border border-white/20 bg-black/40 p-5 backdrop-blur-md">
            <div className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1 text-xs font-semibold text-white">
              <ShieldCheck size={14} />
              Built for shops in Pakistan
            </div>
            <p className="mt-4 text-lg font-semibold text-white">
              Run the till, stock, and books in one place
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Use the web app when you are online. Desktop and mobile cover the
              rest of the day for your team.
            </p>
          </div>
        </div>

        <ul className="relative mt-12 space-y-5">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="flex gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/10 text-sky-200">
                  <Icon size={18} />
                </div>
                <div>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p className="mt-1 text-sm text-slate-300">{item.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>

      <main className="app-atmosphere flex flex-col justify-center px-6 py-12 sm:px-10">
        <div className="relative z-10 mx-auto w-full max-w-md animate-rise rounded-md border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center justify-between gap-3">
            <Link
              href={routes.login}
              className="inline-flex items-center gap-2 text-sm font-semibold text-brand lg:hidden"
            >
              <KaarobarLogo size={28} className="rounded-md" />
              {t("common.appName")}
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
