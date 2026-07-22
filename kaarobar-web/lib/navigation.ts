export const landingNav = [
  { title: "Solutions", href: "/solutions" },
  { title: "Modules", href: "/#modules" },
  { title: "Compare", href: "/#comparison" },
  { title: "Pricing", href: "/#pricing" },
  { title: "FAQ", href: "/#faq" },
] as const;

export const companyNav = [
  { title: "About", href: "/about" },
  { title: "Blog", href: "/blog" },
  { title: "Careers", href: "/careers" },
  { title: "Contact", href: "/contact" },
] as const;

/** Compact company links for desktop navbar */
export const navbarCompanyNav = [
  { title: "About", href: "/about" },
  { title: "Contact", href: "/contact" },
] as const;

export const productLinks = [
  { label: "Solutions", href: "/solutions" },
  { label: "Modules", href: "/#modules" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Mobile App", href: "/#mobile" },
  { label: "FAQ", href: "/#faq" },
] as const;

export const solutionLinks = [
  { label: "Multi-business retail", href: "/solutions/multi-business-retail" },
  { label: "Multi-branch POS", href: "/solutions/multi-branch-pos" },
  { label: "Accounting & tax", href: "/solutions/accounting-tax" },
  { label: "HR & payroll", href: "/solutions/hr-payroll" },
  { label: "FBR Tier-1 ready", href: "/solutions/fbr-tier-1" },
] as const;

export const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
] as const;

export const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-of-service" },
  { label: "Cookie Policy", href: "/cookie-policy" },
] as const;

export const routes = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  app: "/app",
  pos: "/app/pos",
  sales: "/app/sales",
  returns: "/app/returns",
  inventory: "/app/inventory",
  customers: "/app/customers",
  marketing: "/app/marketing",
  accounting: "/app/accounting",
  hr: "/app/hr",
  reports: "/app/reports",
  settings: "/app/settings",
  profile: "/app/profile",
  notifications: "/app/notifications",
  contact: "/contact",
  about: "/about",
  blog: "/blog",
  careers: "/careers",
  solutions: "/solutions",
  privacy: "/privacy-policy",
  terms: "/terms-of-service",
  cookies: "/cookie-policy",
} as const;

/** Detail route helpers for entity pages. */
export const detailRoutes = {
  customer: (id: string) => `/app/customers/${id}`,
  employee: (id: string) => `/app/hr/employees/${id}`,
  sale: (id: string) => `/app/sales/${id}`,
  product: (id: string) => `/app/inventory/products/${id}`,
  supplier: (id: string) => `/app/inventory/suppliers/${id}`,
  campaign: (id: string) => `/app/marketing/campaigns/${id}`,
  arInvoice: (id: string) => `/app/accounting/ar/${id}`,
  apBill: (id: string) => `/app/accounting/ap/${id}`,
  journal: (id: string) => `/app/accounting/journals/${id}`,
  saleReturn: (id: string) => `/app/returns/${id}`,
  payroll: (id: string) => `/app/hr/payroll/${id}`,
  purchaseOrder: (id: string) => `/app/inventory/purchase-orders/${id}`,
} as const;

export const appNav = [
  { titleKey: "nav.dashboard", href: "/app", groupKey: "nav.overview", icon: "layout", bundle: "any_staff" },
  { titleKey: "nav.pos", href: "/app/pos", groupKey: "nav.cashier", icon: "pos", bundle: "pos" },
  { titleKey: "nav.sales", href: "/app/sales", groupKey: "nav.cashier", icon: "sales", bundle: "pos" },
  { titleKey: "nav.returns", href: "/app/returns", groupKey: "nav.cashier", icon: "returns", bundle: "pos" },
  { titleKey: "nav.customers", href: "/app/customers", groupKey: "nav.cashier", icon: "customers", bundle: "customers" },
  { titleKey: "nav.inventory", href: "/app/inventory", groupKey: "nav.catalog", icon: "inventory", bundle: "inventory" },
  { titleKey: "nav.accounting", href: "/app/accounting", groupKey: "nav.backOffice", icon: "accounting", bundle: "accounting" },
  { titleKey: "nav.marketing", href: "/app/marketing", groupKey: "nav.backOffice", icon: "marketing", bundle: "marketing" },
  { titleKey: "nav.hr", href: "/app/hr", groupKey: "nav.backOffice", icon: "hr", bundle: "hr" },
  { titleKey: "nav.reports", href: "/app/reports", groupKey: "nav.backOffice", icon: "reports", bundle: "reports" },
  { titleKey: "nav.notifications", href: "/app/notifications", groupKey: "nav.system", icon: "bell", bundle: "notifications" },
  { titleKey: "nav.profile", href: "/app/profile", groupKey: "nav.system", icon: "profile", bundle: "any_staff" },
  { titleKey: "nav.settings", href: "/app/settings", groupKey: "nav.system", icon: "settings", bundle: "any_staff" },
] as const;

export const appNavGroups = [
  "nav.overview",
  "nav.cashier",
  "nav.catalog",
  "nav.backOffice",
  "nav.system",
] as const;
