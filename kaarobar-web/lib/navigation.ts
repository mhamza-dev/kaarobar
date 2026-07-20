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
  returns: "/app/returns",
  inventory: "/app/inventory",
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

export const appNav = [
  { titleKey: "nav.dashboard", href: "/app", groupKey: "nav.overview", icon: "layout" },
  { titleKey: "nav.pos", href: "/app/pos", groupKey: "nav.cashier", icon: "pos" },
  { titleKey: "nav.returns", href: "/app/returns", groupKey: "nav.cashier", icon: "returns" },
  { titleKey: "nav.inventory", href: "/app/inventory", groupKey: "nav.catalog", icon: "inventory" },
  { titleKey: "nav.accounting", href: "/app/accounting", groupKey: "nav.backOffice", icon: "accounting" },
  { titleKey: "nav.hr", href: "/app/hr", groupKey: "nav.backOffice", icon: "hr" },
  { titleKey: "nav.reports", href: "/app/reports", groupKey: "nav.backOffice", icon: "reports" },
  { titleKey: "nav.notifications", href: "/app/notifications", groupKey: "nav.system", icon: "bell" },
  { titleKey: "nav.profile", href: "/app/profile", groupKey: "nav.system", icon: "profile" },
  { titleKey: "nav.settings", href: "/app/settings", groupKey: "nav.system", icon: "settings" },
] as const;

export const appNavGroups = [
  "nav.overview",
  "nav.cashier",
  "nav.catalog",
  "nav.backOffice",
  "nav.system",
] as const;
