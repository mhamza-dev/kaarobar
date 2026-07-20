export type Solution = {
  slug: string;
  label: string;
  badge: string;
  headline: string;
  subhead: string;
  summary: string;
  highlights: { title: string; body: string }[];
  outcomes: string[];
};

export const solutions: Solution[] = [
  {
    slug: "multi-business-retail",
    label: "Multi-business retail",
    badge: "One owner, many companies",
    headline: "One login for every business you own.",
    subhead:
      "Run shops, trading companies, and service units under a single owner account—without mixing their books or staff access.",
    summary:
      "Kaarobar is built for owners who grow by opening new businesses, not only new tills. Each business keeps its own books, catalog rules, and branches. You still get one overview of how everything is doing.",
    highlights: [
      {
        title: "Separate books per company",
        body: "Each business has its own chart of accounts, tax setup, and statements—so entities don’t bleed into each other.",
      },
      {
        title: "Staff only see what they need",
        body: "Assign cashiers and managers to specific branches—or the whole business—without opening other companies.",
      },
      {
        title: "You still see the whole picture",
        body: "Sales, cash, stock, and payroll across every business from one dashboard.",
      },
      {
        title: "Same tools, clean separation",
        body: "Reuse POS, inventory, and HR patterns across businesses while keeping the data apart.",
      },
    ],
    outcomes: [
      "Add another business without a new product login",
      "Compare how branches perform across companies",
      "Keep history and audits scoped to the right business",
    ],
  },
  {
    slug: "multi-branch-pos",
    label: "Multi-branch POS",
    badge: "Till & sales",
    headline: "Branch tills that stay fast—even offline.",
    subhead:
      "Checkout, split payments, discounts, returns, and till close designed for shops that don’t always have a perfect connection.",
    summary:
      "Cashiers work at branch speed. You keep approval limits and a clear view of sales. The desktop till remembers the catalog and stock so an outage measured in hours doesn’t stop the day.",
    highlights: [
      {
        title: "Works when the line drops",
        body: "Sales are saved locally with a unique ID and sync up later—without creating duplicates if the connection flickers.",
      },
      {
        title: "Prices and stock per branch",
        body: "Share a business catalog, but let each shop keep its own prices and quantities.",
      },
      {
        title: "Approvals that scale",
        body: "Discount and return limits let cashiers move fast while managers catch the exceptions.",
      },
      {
        title: "Hardware you already know",
        body: "Thermal receipts, barcode scanners, cash drawers—and a lighter browser till when you don’t need the full desktop setup.",
      },
    ],
    outcomes: [
      "Open and close tills with a clean shift count",
      "Process returns without breaking stock or the books",
      "Keep selling through shaky connectivity",
    ],
  },
  {
    slug: "accounting-tax",
    label: "Accounting & tax",
    badge: "Real books",
    headline: "Sales that post themselves into proper books.",
    subhead:
      "Pakistan chart of accounts, locked journals, trial balance, P&L—and tax settings that live with the business.",
    summary:
      "Kaarobar isn’t a cash notebook. Finished sales, returns, goods receipts, and approved payroll create balanced journals. Once posted, entries stay put; fixes use reversing entries so history stays honest.",
    highlights: [
      {
        title: "Operations feed the ledger",
        body: "POS, inventory, and payroll create journals so statements stay ready for review.",
      },
      {
        title: "Tax that fits Pakistan",
        body: "Configurable rates with sensible Pakistan defaults for receipts and reporting.",
      },
      {
        title: "Posted means posted",
        body: "No quiet edits after the fact—reversals keep the trail clean.",
      },
      {
        title: "Owner and branch views",
        body: "Company-level statements with the operational detail underneath when you need it.",
      },
    ],
    outcomes: [
      "Stop reconciling a separate accounting app every night",
      "Print tax-ready receipts from the till",
      "Trust that payroll lands in the same books",
    ],
  },
  {
    slug: "hr-payroll",
    label: "HR & payroll",
    badge: "Your people",
    headline: "Attendance and payroll that close into the ledger.",
    subhead:
      "Employee records, clock-in from till or phone, leave, deductions, and payroll approval that posts to accounting.",
    summary:
      "HR shouldn’t live in a side spreadsheet. Staff clock in where they work, managers approve leave and payroll, and approved runs post into the books so finance matches the floor.",
    highlights: [
      {
        title: "People tied to branches",
        body: "Assign staff to the shops they work in, with roles that match the till, stock, or manager work.",
      },
      {
        title: "Clock in where work happens",
        body: "Attendance from the POS or the phone—so records follow the shop floor.",
      },
      {
        title: "Leave with a paper trail",
        body: "Request and approve leave with a history you can trust.",
      },
      {
        title: "Payroll into the books",
        body: "Calculate, approve, and post so wages and deductions hit the ledger automatically.",
      },
    ],
    outcomes: [
      "Less re-entry of payroll into accounting",
      "Staff can check payslips and leave themselves",
      "Deductions you can configure for how you pay people",
    ],
  },
  {
    slug: "fbr-tier-1",
    label: "FBR Tier-1 ready",
    badge: "Pakistan compliance",
    headline: "Tier-1 reporting without freezing the till.",
    subhead:
      "Flag Tier-1 businesses, report sales in the background, and print invoice number plus QR when FBR responds.",
    summary:
      "Cashiers shouldn’t wait on a government API. Reporting is queued and retries on its own; receipts pick up fiscal fields when they’re ready.",
    highlights: [
      {
        title: "Turn it on per business",
        body: "Enable FBR only for businesses that actually need Tier-1 reporting.",
      },
      {
        title: "Sale first, report after",
        body: "The customer leaves with a receipt. FBR submission runs behind the scenes with retries.",
      },
      {
        title: "Fiscal details on the slip",
        body: "Invoice number and QR land on the receipt when FBR returns them.",
      },
      {
        title: "Offline doesn’t lose the queue",
        body: "If you’re offline, fiscal payloads wait and catch up when you’re back—without inventing duplicate invoices.",
      },
    ],
    outcomes: [
      "Stay fast at checkout under Tier-1 rules",
      "Keep fiscal details on printed receipts",
      "Retry failed reports without cashier drama",
    ],
  },
];

export function getSolution(slug: string): Solution | undefined {
  return solutions.find((s) => s.slug === slug);
}

export function solutionHref(slug: string): string {
  return `/solutions/${slug}`;
}
