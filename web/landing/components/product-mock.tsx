import {
  BarChart3,
  Boxes,
  ChevronRight,
  LayoutDashboard,
  Package,
  Receipt,
  ScanLine,
  Users,
} from "lucide-react";

import { LogoMark } from "@/components/logo";

/**
 * A drawing of the web app — its dashboard, with a sale in progress at the
 * till floating over it — for the hero. Built from markup rather than a
 * screenshot so it's sharp at every size, themes with the page, and follows
 * the real app's layout (sidebar, hero figure, chart, best sellers).
 *
 * Decorative: hidden from assistive tech, which gets the hero copy instead.
 */

const nav = [
  { icon: LayoutDashboard, label: "Dashboard", active: true },
  { icon: ScanLine, label: "Till" },
  { icon: Receipt, label: "Sales" },
  { icon: Package, label: "Products" },
  { icon: Boxes, label: "Stock" },
  { icon: Users, label: "Customers" },
  { icon: BarChart3, label: "Reports" },
];

// Fourteen days of takings, drawn as the app draws them: straight segments.
const trend = [42, 48, 39, 55, 51, 58, 46, 62, 57, 66, 61, 72, 68, 84];

const bestSellers = [
  { name: "Basmati rice 5kg", share: 100 },
  { name: "Cooking oil 3L", share: 78 },
  { name: "Tea 950g", share: 61 },
  { name: "Atta 10kg", share: 44 },
];

const basket = [
  { name: "Basmati rice 5kg", qty: "1", amount: "2,150" },
  { name: "Cooking oil 3L", qty: "2", amount: "3,780" },
  { name: "Tea 950g", qty: "1", amount: "1,480" },
];

function trendPath(width: number, height: number) {
  const max = Math.max(...trend);
  const step = width / (trend.length - 1);
  const points = trend.map((value, index) => [index * step, height - (value / max) * height * 0.9]);
  const line = points.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${width},${height} L0,${height} Z` };
}

export function ProductMock() {
  const { line, area } = trendPath(240, 64);

  return (
    <div aria-hidden="true" className="relative">
      <div className="absolute -inset-8 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand/30 via-brand/10 to-transparent blur-3xl" />

      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-brand/15 ring-1 ring-black/5">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="mx-auto truncate rounded-md bg-surface-muted px-10 py-1 text-[10px] text-ink-muted">
            Dashboard · Khan Kiryana
          </span>
        </div>

        <div className="grid sm:grid-cols-[8.5rem_1fr]">
          {/* Sidebar */}
          <div className="hidden flex-col gap-3 border-r border-line bg-surface p-3 sm:flex">
            <div className="flex items-center gap-1.5">
              <LogoMark className="size-5" />
              <span className="text-[11px] font-semibold text-ink">Kaarobar</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-line p-1.5">
              <span className="flex size-5 items-center justify-center rounded-md bg-brand text-[9px] font-semibold text-on-brand">
                K
              </span>
              <span className="truncate text-[10px] font-medium text-ink">Khan Kiryana</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {nav.map((item) => (
                <li
                  key={item.label}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] font-medium ${
                    item.active ? "bg-brand-tint text-brand-ink" : "text-ink-muted"
                  }`}
                >
                  <item.icon className="size-3" />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          {/* Dashboard */}
          <div className="flex flex-col gap-2.5 bg-surface-muted p-3 sm:p-4">
            <div>
              <p className="flex items-center gap-1.5 text-[9px] font-semibold tracking-wider text-ink-muted uppercase">
                <span className="size-1 rounded-full bg-brand" />
                Khan Kiryana
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink">Welcome back</p>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-2 flex flex-col justify-between rounded-lg border border-line bg-surface p-2.5">
                <p className="text-[9px] text-ink-muted">Net sales today</p>
                <p className="text-lg font-semibold tracking-tight text-ink">Rs 184,320</p>
                <div className="mt-1 grid grid-cols-2 gap-1 rounded-md border border-line bg-surface-muted p-1.5 text-[8px] text-ink-muted">
                  <span>
                    Sales <b className="block text-[10px] text-ink">142</b>
                  </span>
                  <span>
                    Average <b className="block text-[10px] text-ink">Rs 1,298</b>
                  </span>
                </div>
              </div>
              <div className="col-span-3 rounded-lg border border-line bg-surface p-2.5">
                <p className="text-[9px] font-semibold text-ink">Net sales</p>
                <p className="text-[8px] text-ink-muted">Last 14 days</p>
                <svg viewBox="0 0 240 64" className="mt-1.5 h-14 w-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="mock-wash" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.18" />
                      <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>
                  {[16, 32, 48].map((y) => (
                    <line key={y} x1="0" x2="240" y1={y} y2={y} stroke="var(--line)" strokeWidth="1" />
                  ))}
                  <path d={area} fill="url(#mock-wash)" />
                  <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              <div className="col-span-3 rounded-lg border border-line bg-surface p-2.5">
                <p className="text-[9px] font-semibold text-ink">Best sellers this week</p>
                <ul className="mt-1.5 flex flex-col gap-1.5">
                  {bestSellers.map((item) => (
                    <li key={item.name}>
                      <span className="block truncate text-[8px] text-ink">{item.name}</span>
                      <span className="mt-0.5 block h-1.5 rounded-r-sm bg-brand/80" style={{ width: `${item.share}%` }} />
                    </li>
                  ))}
                </ul>
              </div>
              <div className="col-span-2 rounded-lg border border-line bg-surface p-2.5">
                <p className="text-[9px] font-semibold text-ink">Shortcuts</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {["Ring up a sale", "Check stock", "Find a customer"].map((label) => (
                    <li key={label} className="flex items-center justify-between text-[8px] text-ink">
                      {label}
                      <ChevronRight className="size-2.5 text-ink-muted" />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The till, mid-sale, floating over the window */}
      <div className="absolute -right-4 -bottom-14 hidden w-56 rounded-xl border border-line bg-surface p-3 shadow-2xl shadow-ink/15 sm:block xl:-right-10">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-semibold text-ink">Current sale</p>
          <span className="rounded-full bg-brand-tint px-2 py-0.5 text-[9px] font-medium text-brand-ink">4 items</span>
        </div>
        <ul className="mt-2 flex flex-col gap-1.5">
          {basket.map((item) => (
            <li key={item.name} className="flex justify-between gap-2 text-[10px]">
              <span className="truncate text-ink">
                <span className="text-ink-muted">{item.qty} × </span>
                {item.name}
              </span>
              <span className="shrink-0 text-ink tabular-nums">{item.amount}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2.5 flex items-baseline justify-between border-t border-line pt-2">
          <span className="text-[10px] text-ink-muted">Total</span>
          <span className="text-base font-semibold text-ink tabular-nums">Rs 7,410</span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {["Cash", "Card", "Wallet"].map((method, index) => (
            <span
              key={method}
              className={`rounded-md py-1 text-center text-[9px] font-medium ${
                index === 0 ? "bg-brand text-on-brand" : "border border-line text-ink"
              }`}
            >
              {method}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
