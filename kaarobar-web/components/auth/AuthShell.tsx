import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  BrainCircuit,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { routes } from "@/lib/navigation";

const highlights = [
  {
    icon: Boxes,
    title: "Unified Operations",
    description: "POS, inventory, accounting, and HR in one platform.",
  },
  {
    icon: BrainCircuit,
    title: "AI Insights",
    description: "Get actionable recommendations as your business grows.",
  },
  {
    icon: BarChart3,
    title: "Live Analytics",
    description: "Track sales, profit, and performance in real time.",
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
    <div className="relative min-h-screen overflow-hidden surface-mesh surface-noise">
      <div className="pointer-events-none absolute inset-0 surface-grid opacity-50" />
      <div className="absolute -left-24 top-20 h-72 w-72 rounded-full bg-brand/15 blur-[110px]" />
      <div className="absolute -right-16 bottom-10 h-80 w-80 rounded-full bg-accent/15 blur-[120px]" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href={routes.home}
            className="inline-flex items-center gap-2 text-sm font-medium text-body transition hover:text-brand"
          >
            <ArrowLeft size={16} />
            Back to home
          </Link>

          <Link href={routes.home} className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-sm font-bold text-white shadow-brand">
              K
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-heading">Kaarobar</p>
              <p className="text-xs text-muted">Business Operating System</p>
            </div>
          </Link>
        </div>

        <div className="grid flex-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <aside className="hidden lg:block">
            <div className="rounded-4xl border border-border/70 bg-card/80 p-10 shadow-xl backdrop-blur-sm">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-4 py-2 text-sm font-semibold text-brand">
                <Sparkles size={16} />
                AI Powered Business OS
              </div>

              <h2 className="mt-8 text-4xl font-bold leading-tight text-heading xl:text-5xl">
                Run your entire business
                <span className="block text-gradient">from one login.</span>
              </h2>

              <p className="mt-5 max-w-lg text-lg leading-8 text-body">
                Secure access to POS, inventory, accounting, payroll, CRM and AI
                insights — built for modern teams.
              </p>

              <div className="mt-10 space-y-5">
                {highlights.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.title}
                      className="flex items-start gap-4 rounded-2xl border border-border bg-bg-primary/70 p-4"
                    >
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                        <Icon size={20} />
                      </div>
                      <div>
                        <p className="font-semibold text-heading">{item.title}</p>
                        <p className="mt-1 text-sm leading-6 text-body">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 flex items-center gap-3 rounded-2xl bg-brand-gradient-soft px-4 py-3 text-sm text-body">
                <ShieldCheck size={18} className="text-brand" />
                Enterprise-grade security with encrypted sessions
              </div>
            </div>
          </aside>

          <main className="mx-auto w-full max-w-xl">
            <div className="rounded-4xl border border-border bg-card p-6 shadow-xl sm:p-8 md:p-10">
              <div className="mb-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand">
                  <Sparkles size={14} />
                  {badge}
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-heading sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-2 text-body">{subtitle}</p>
              </div>

              {children}

              <div className="mt-8 border-t border-border pt-6 text-center text-sm text-body">
                {footer}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
