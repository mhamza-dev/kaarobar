import {
  BarChart3,
  Boxes,
  ChefHat,
  CreditCard,
  Scissors,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Truck,
  Users,
  Wrench,
  Pill,
  KeyRound,
  Building2,
  type LucideIcon,
} from "lucide-react";

/**
 * The words on the site. Kept apart from the layout so the copy can be
 * edited without touching a component — and so every claim lives in one
 * place where it can be checked against what the product actually does.
 *
 * Every feature listed here exists in the backend today (`backend/lib`).
 * Nothing about offline use: that's the separate desktop/local product, and
 * the subscription apps need a connection.
 */

export type FeatureArea = {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  points: string[];
};

export const featureAreas: FeatureArea[] = [
  {
    id: "point-of-sale",
    icon: ShoppingBasket,
    title: "Point of sale",
    summary: "A till that keeps up with a queue — scan, search or tap, then take payment however the customer pays.",
    points: [
      "Barcode scanning, including price-embedded codes from weighing scales",
      "Split payments across cash, card, wallets, store credit and gift cards",
      "Hold a basket, serve the next customer, and pick it back up",
      "Line and order discounts, promotions, happy-hour pricing and coupon codes",
      "Thermal receipts and A4 invoices, with gapless invoice numbering",
      "Shifts with opening float, cash in and out, and X and Z reports",
      "Refunds and returns, with manager approval when you want it",
    ],
  },
  {
    id: "inventory",
    icon: Boxes,
    title: "Stock & inventory",
    summary: "Know what you have in every branch, and why every number is what it is.",
    points: [
      "Live stock per branch, with every movement recorded in a ledger",
      "Transfers between branches with dispatch, receiving and discrepancies",
      "Stock counts with variance approval before anything changes",
      "Batches with expiry dates, and serial numbers for high-value items",
      "Reorder suggestions from your own reorder points",
      "Valuation by FIFO or weighted average",
    ],
  },
  {
    id: "purchasing",
    icon: Truck,
    title: "Purchasing & suppliers",
    summary: "From the order you place to the bill you pay, in one trail.",
    points: [
      "Purchase orders with approval, and goods received against them",
      "Supplier bills, part payments and a running supplier ledger",
      "Purchase returns that put stock and money back where they belong",
      "Supplier price lists and their codes for each product",
    ],
  },
  {
    id: "customers",
    icon: Users,
    title: "Customers, credit & loyalty",
    summary: "Keep regulars coming back, and keep track of who owes what.",
    points: [
      "Customer profiles, groups, addresses and notes",
      "Credit limits and a customer ledger (khata), with part payments allocated across invoices",
      "Receivables ageing so you know who to call first",
      "Loyalty points, gift cards and store credit",
      "Follow-ups so nobody slips through the cracks",
    ],
  },
  {
    id: "industry-tools",
    icon: Store,
    title: "Tools for your industry",
    summary: "Kaarobar switches on what your kind of business needs — and keeps the rest out of the way.",
    points: [
      "Restaurants: tables and floor plans, kitchen display, modifiers, recipes and delivery riders",
      "Salons and clinics: appointments, walk-in queue, served-by and staff commissions",
      "Laundry, tailoring and repair: tagged service jobs from intake to collection",
      "Rentals: agreements, deposits, returns and late fees",
      "Pharmacy and agri: enforced batch and expiry, and a regulated-sales register",
      "Professional services: quotes, time tracking and invoicing",
    ],
  },
  {
    id: "reports",
    icon: BarChart3,
    title: "Reports & insight",
    summary: "The numbers an owner actually looks at, without exporting to a spreadsheet first.",
    points: [
      "Sales by day, hour, branch, cashier, product and payment method",
      "Profit and margin from the cost at the time of each sale",
      "Tax, expiry, low-stock and staff-performance reports",
      "Expenses and bank accounts for a real profit and loss",
      "Everything exportable to CSV",
    ],
  },
  {
    id: "team",
    icon: ShieldCheck,
    title: "Staff, roles & security",
    summary: "Give everyone exactly the access their job needs — and see who did what.",
    points: [
      "Ready-made roles — owner, manager, cashier, stock keeper, waiter and more — or build your own",
      "Limit a person to particular branches",
      "Two-step sign-in with an authenticator app, and sign-out from any device remotely",
      "An audit log of every sensitive action",
      "Each business's data isolated from every other's, down to the database",
    ],
  },
  {
    id: "payments",
    icon: CreditCard,
    title: "Payments, tax & compliance",
    summary: "Local payment methods and local tax rules, built in rather than bolted on.",
    points: [
      "Card payments through Stripe, and JazzCash and Easypaisa wallets",
      "Tax rates and groups, priced inclusive or exclusive of tax",
      "FBR POS invoice reporting, retried automatically when the connection drops",
    ],
  },
  {
    id: "multi-branch",
    icon: Building2,
    title: "Many branches, many businesses",
    summary: "Grow from one counter to several shops — even several kinds of shop — under one login.",
    points: [
      "One owner account for several businesses, each with its own branches",
      "Prices, stock and staff set per branch where you need them to differ",
      "Switch between businesses in a click",
    ],
  },
];

export type IndustryGroup = {
  id: string;
  icon: LucideIcon;
  title: string;
  summary: string;
  examples: string[];
  includes: string[];
};

/**
 * Mirrors the business-type groups in `Kaarobar.Verticals`; the examples are
 * its own labels. `includes` is what the type switches on.
 */
export const industries: IndustryGroup[] = [
  {
    id: "retail",
    icon: ShoppingBasket,
    title: "Retail & grocery",
    summary: "Fast counters, big catalogues, and stock that's right.",
    examples: [
      "General retail",
      "Grocery / kiryana",
      "Clothing & apparel",
      "Electronics & mobile",
      "Hardware & building materials",
      "Jewellery",
      "Books & stationery",
      "Florist",
    ],
    includes: [
      "Size and colour variants",
      "Products sold by weight",
      "Customer credit (khata)",
      "Purchase orders and suppliers",
      "Loyalty and gift cards",
    ],
  },
  {
    id: "food",
    icon: ChefHat,
    title: "Restaurants & cafés",
    summary: "From the table to the kitchen to the bill — split however the table wants.",
    examples: ["Restaurant", "Café / tea shop", "Fast food / takeaway", "Bakery & sweets", "Butchery & meat shop"],
    includes: [
      "Tables, floors and open tickets",
      "Kitchen display with course firing",
      "Modifiers and add-ons",
      "Recipes that use up ingredients",
      "Dine-in, takeaway and delivery with riders",
    ],
  },
  {
    id: "beauty",
    icon: Scissors,
    title: "Salons, spas & wellness",
    summary: "A diary that fills itself in, and commissions worked out for you.",
    examples: ["Salon", "Spa & wellness", "Barbershop", "Clinic & diagnostics", "Gym & fitness studio", "Academy & training centre", "Pet care & grooming"],
    includes: [
      "Appointments and resources",
      "Walk-in queue",
      "Served-by on every sale",
      "Staff commission rules",
      "Memberships and packages",
    ],
  },
  {
    id: "services",
    icon: Wrench,
    title: "Laundry, tailoring & repair",
    summary: "Every item tagged in, tracked through, and handed back to the right person.",
    examples: ["Laundry & ironing", "Tailoring & alterations", "Repair shop", "Auto workshop", "General service provider"],
    includes: [
      "Service jobs from intake to delivery",
      "Tag barcodes for every garment or device",
      "Ready-by dates and rack locations",
    ],
  },
  {
    id: "regulated",
    icon: Pill,
    title: "Pharmacy, agri & optical",
    summary: "The batch, the expiry and the licence on every sale, without extra paperwork.",
    examples: ["Pharmacy", "Pesticides, fertiliser & agri supplies", "Optical"],
    includes: [
      "Enforced batch and expiry tracking",
      "Near-expiry alerts",
      "A regulated-sales register",
      "Prescription-only items",
    ],
  },
  {
    id: "rental",
    icon: KeyRound,
    title: "Rentals & professional services",
    summary: "Agreements, deposits and time — billed correctly.",
    examples: ["Rental business", "Professional services & consultancy"],
    includes: [
      "Rental agreements, deposits and late fees",
      "Availability calendar",
      "Quotes that become jobs and invoices",
      "Time tracking and utilisation",
    ],
  },
];

/** Friendly names for the backend's module keys, grouped for the pricing comparison. */
export const moduleGroups: Array<{ title: string; modules: Record<string, string> }> = [
  {
    title: "Everyday selling",
    modules: {
      pos: "Point of sale",
      catalog: "Products & catalogue",
      inventory: "Stock tracking",
      sales: "Sales history & returns",
      customers: "Customer records",
      reports: "Reports & dashboards",
      staff: "Staff & roles",
      export: "Data export",
    },
  },
  {
    title: "Stock & buying",
    modules: {
      variants: "Size & colour variants",
      purchasing: "Purchase orders",
      suppliers: "Suppliers & payables",
      credit: "Customer credit (khata)",
      batches: "Batch & expiry tracking",
      weighted: "Sold by weight",
      recipes: "Recipes & ingredients",
      serials: "Serial numbers",
    },
  },
  {
    title: "Customers",
    modules: {
      loyalty: "Loyalty points",
      gift_cards: "Gift cards & store credit",
      memberships: "Memberships",
      quotes: "Quotes & estimates",
    },
  },
  {
    title: "Restaurants",
    modules: {
      tables: "Tables & floor plan",
      kitchen: "Kitchen display",
      modifiers: "Modifiers & add-ons",
      service_modes: "Dine-in, takeaway & delivery",
      delivery: "Delivery & riders",
    },
  },
  {
    title: "Services",
    modules: {
      appointments: "Appointments",
      queue: "Walk-in queue",
      served_by: "Served-by tracking",
      commissions: "Staff commissions",
      service_jobs: "Service jobs",
      time_entries: "Time tracking",
      rentals: "Rentals",
      prescriptions: "Prescription-only items",
    },
  },
];

export const limitLabels: Record<string, string> = {
  max_businesses: "Businesses",
  max_branches: "Branches",
  max_users: "Staff accounts",
};

export type Faq = { question: string; answer: string };

export const generalFaqs: Faq[] = [
  {
    question: "Do I need a card to start the free trial?",
    answer:
      "No. Pick a plan, create your account and start using Kaarobar straight away. You can add a card at any point during the trial and you won't be charged until it ends.",
  },
  {
    question: "Which devices does Kaarobar work on?",
    answer:
      "Any computer with a modern browser, today. Desktop and mobile apps use the same account and the same subscription — the Download page lists what's available.",
  },
  {
    question: "Can I change or cancel my plan later?",
    answer:
      "Yes, from Settings → Subscription. A cancellation takes effect at the end of the period you've paid for, so you keep what you paid for.",
  },
  {
    question: "What happens if a payment fails?",
    answer:
      "Nothing stops. You keep working for a 14-day grace period while you sort the card out, and we remind you before anything changes.",
  },
  {
    question: "Is my data mine?",
    answer:
      "Yes. You can export your records at any time — even if your subscription has ended — and each business's data is kept separate from every other's.",
  },
  {
    question: "Does it handle Pakistani tax and payments?",
    answer:
      "Yes. Prices are in rupees, taxes can be inclusive or exclusive, JazzCash and Easypaisa are supported, and Kaarobar can report invoices to the FBR.",
  },
];

/**
 * The billing questions. How payment works depends on whether this
 * deployment takes cards (`checkout_enabled` from the API), so the answer is
 * never a promise the product can't keep.
 */
export function pricingFaqs(checkoutEnabled: boolean): Faq[] {
  return [
    {
      question: "How does the free trial work?",
      answer:
        "Every plan starts with a free trial and no card. Near the end we'll remind you to choose how to pay. If you add a card early, the first charge still waits until the trial is over.",
    },
    {
      question: "How do I pay?",
      answer: checkoutEnabled
        ? "By card, through Stripe's secure checkout, collected automatically each period. Card details never touch Kaarobar's servers."
        : "We send an invoice each period. Get in touch and we'll set up the payment method that suits you.",
    },
    {
      question: "Can I switch plans?",
      answer:
        "Any time. An upgrade takes effect straight away and is prorated on your next invoice — your billing date doesn't move.",
    },
    {
      question: "What if I need more branches or staff than a plan allows?",
      answer:
        "Move up a plan — the top plan has no limits. If you're larger than that, get in touch and we'll talk.",
    },
  ];
}
