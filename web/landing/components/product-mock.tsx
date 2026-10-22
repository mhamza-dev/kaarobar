/**
 * A drawing of the till, for the hero — built from markup rather than a
 * screenshot so it's sharp at every size, themes with the page, and never
 * goes stale against a real screen that has since changed.
 *
 * Decorative: hidden from assistive tech, which gets the hero copy instead.
 */

const products = [
  { name: "Basmati rice 5kg", price: "Rs 2,150", tint: "bg-amber-100 dark:bg-amber-500/20" },
  { name: "Cooking oil 3L", price: "Rs 1,890", tint: "bg-yellow-100 dark:bg-yellow-500/20" },
  { name: "Tea 950g", price: "Rs 1,480", tint: "bg-orange-100 dark:bg-orange-500/20" },
  { name: "Sugar 1kg", price: "Rs 165", tint: "bg-sky-100 dark:bg-sky-500/20" },
  { name: "Milk 1L", price: "Rs 220", tint: "bg-blue-100 dark:bg-blue-500/20" },
  { name: "Atta 10kg", price: "Rs 1,350", tint: "bg-lime-100 dark:bg-lime-500/20" },
];

const lines = [
  { name: "Basmati rice 5kg", qty: "1 ×", amount: "2,150" },
  { name: "Cooking oil 3L", qty: "2 ×", amount: "3,780" },
  { name: "Tea 950g", qty: "1 ×", amount: "1,480" },
];

export function ProductMock() {
  return (
    <div aria-hidden="true" className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-brand/25 via-brand/5 to-transparent blur-2xl" />
      <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-brand/10">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-line bg-surface-muted px-4 py-3">
          <span className="size-2.5 rounded-full bg-red-400/80" />
          <span className="size-2.5 rounded-full bg-amber-400/80" />
          <span className="size-2.5 rounded-full bg-emerald-400/80" />
          <span className="ml-3 truncate rounded-md bg-surface px-3 py-1 text-[11px] text-ink-muted">
            Till · Khan Kiryana — Main branch
          </span>
        </div>

        <div className="grid grid-cols-[1.35fr_1fr]">
          {/* Product wall */}
          <div className="border-r border-line p-3 sm:p-4">
            <div className="mb-3 flex h-8 items-center rounded-lg border border-line px-3 text-[11px] text-ink-muted">
              Scan or search products…
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {products.map((product) => (
                <div key={product.name} className="rounded-lg border border-line p-2">
                  <div className={`mb-2 h-8 rounded-md sm:h-10 ${product.tint}`} />
                  <p className="truncate text-[10px] font-medium text-ink sm:text-[11px]">{product.name}</p>
                  <p className="text-[10px] text-ink-muted">{product.price}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Basket */}
          <div className="flex flex-col p-3 sm:p-4">
            <p className="text-[11px] font-semibold text-ink">Current sale</p>
            <ul className="mt-2 flex flex-col gap-2">
              {lines.map((line) => (
                <li key={line.name} className="flex items-start justify-between gap-2 text-[10px] sm:text-[11px]">
                  <span className="min-w-0">
                    <span className="block truncate text-ink">{line.name}</span>
                    <span className="text-ink-muted">{line.qty}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-ink">{line.amount}</span>
                </li>
              ))}
            </ul>
            <div className="mt-auto border-t border-line pt-3">
              <div className="flex justify-between text-[10px] text-ink-muted">
                <span>Tax (incl.)</span>
                <span className="tabular-nums">1,022</span>
              </div>
              <div className="mt-1 flex justify-between text-sm font-semibold text-ink">
                <span>Total</span>
                <span className="tabular-nums">Rs 7,410</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <span className="rounded-md bg-brand py-1.5 text-center text-[10px] font-medium text-on-brand">
                  Cash
                </span>
                <span className="rounded-md border border-line py-1.5 text-center text-[10px] font-medium text-ink">
                  Card / wallet
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* A notification card, overlapping the frame */}
      <div className="absolute -bottom-6 -left-4 hidden w-56 rounded-xl border border-line bg-surface p-3 shadow-xl sm:block">
        <p className="text-[11px] font-semibold text-ink">Today, all branches</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-ink">Rs 184,320</p>
        <div className="mt-2 flex h-8 items-end gap-1">
          {[40, 55, 35, 70, 60, 85, 100].map((height, index) => (
            <span key={index} className="flex-1 rounded-sm bg-brand/70" style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
