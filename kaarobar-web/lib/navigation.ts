export const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms & Conditions", href: "/terms-of-service" },
  { label: "Cookie Policy", href: "/cookie-policy" },
] as const;

export const routes = {
  home: "/login",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  app: "/app",
  products: "/app/products",
  account: "/app/account",
  pos: "/app/pos",
  sales: "/app/sales",
  appointments: "/app/appointments",
  returns: "/app/returns",
  inventory: "/app/inventory",
  customers: "/app/customers",
  marketing: "/app/marketing",
  accounting: "/app/accounting",
  hr: "/app/hr",
  reports: "/app/reports",
  settings: "/app/settings",
  profile: "/app/settings?tab=profile",
  businesses: "/app/businesses",
  notifications: "/app/notifications",
  privacy: "/privacy-policy",
  terms: "/terms-of-service",
  cookies: "/cookie-policy",
  supportEmail: "mailto:support@kaarobar.com",
} as const;

/** Detail route helpers for entity pages. */
export const detailRoutes = {
  customer: (id: string) => `/app/customers/${id}`,
  employee: (id: string) => `/app/hr/employees/${id}`,
  sale: (id: string) => `/app/sales/${id}`,
  appointment: (id: string) => `/app/sales/appointments/${id}`,
  product: (id: string) => `/app/inventory/products/${id}`,
  marketProduct: (businessId: string, productId: string) =>
    `/app/market/${businessId}/product/${productId}`,
  supplier: (id: string) => `/app/inventory/suppliers/${id}`,
  campaign: (id: string) => `/app/marketing/campaigns/${id}`,
  template: (id: string) => `/app/marketing/templates/${id}`,
  arInvoice: (id: string) => `/app/accounting/ar/${id}`,
  apBill: (id: string) => `/app/accounting/ap/${id}`,
  journal: (id: string) => `/app/accounting/journals/${id}`,
  saleReturn: (id: string) => `/app/returns/${id}`,
  payroll: (id: string) => `/app/hr/payroll/${id}`,
  purchaseOrder: (id: string) => `/app/inventory/purchase-orders/${id}`,
  business: (id: string) => `/app/businesses/${id}`,
} as const;

/** Buyer marketplace primary nav (consumer sessions). */
export const buyerNav = [
  { href: "/app", titleKey: "nav.discover", icon: "pos" as const },
  { href: "/app/account", titleKey: "nav.account", icon: "profile" as const },
  { href: "/app/sales", titleKey: "nav.orders", icon: "sales" as const },
  { href: "/app/customers", titleKey: "nav.loyalty", icon: "customers" as const },
] as const;

export const appNav = [
  { titleKey: "nav.dashboard", href: "/app", groupKey: "nav.overview", icon: "layout", bundle: "any_staff" },
  { titleKey: "nav.pos", href: "/app/pos", groupKey: "nav.cashier", icon: "pos", bundle: "pos" },
  { titleKey: "nav.sales", href: "/app/sales", groupKey: "nav.cashier", icon: "sales", bundle: "pos" },
  { titleKey: "nav.appointments", href: "/app/appointments", groupKey: "nav.cashier", icon: "customers", bundle: "pos" },
  { titleKey: "nav.returns", href: "/app/returns", groupKey: "nav.cashier", icon: "returns", bundle: "pos" },
  { titleKey: "nav.customers", href: "/app/customers", groupKey: "nav.cashier", icon: "customers", bundle: "customers" },
  { titleKey: "nav.inventory", href: "/app/inventory", groupKey: "nav.catalog", icon: "inventory", bundle: "inventory" },
  { titleKey: "nav.accounting", href: "/app/accounting", groupKey: "nav.backOffice", icon: "accounting", bundle: "accounting" },
  { titleKey: "nav.marketing", href: "/app/marketing", groupKey: "nav.backOffice", icon: "marketing", bundle: "marketing" },
  { titleKey: "nav.hr", href: "/app/hr", groupKey: "nav.backOffice", icon: "hr", bundle: "hr" },
  { titleKey: "nav.reports", href: "/app/reports", groupKey: "nav.backOffice", icon: "reports", bundle: "reports" },
  { titleKey: "nav.notifications", href: "/app/notifications", groupKey: "nav.system", icon: "bell", bundle: "notifications" },
  { titleKey: "nav.businesses", href: "/app/businesses", groupKey: "nav.system", icon: "settings", bundle: "owner_manage" },
  { titleKey: "nav.settings", href: "/app/settings", groupKey: "nav.system", icon: "settings", bundle: "any_staff" },
] as const;

export const appNavGroups = [
  "nav.overview",
  "nav.cashier",
  "nav.catalog",
  "nav.backOffice",
  "nav.system",
] as const;
