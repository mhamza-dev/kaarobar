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
  { title: "Dashboard", href: "/app", group: "Overview", icon: "layout" },
  { title: "POS", href: "/app/pos", group: "Cashier", icon: "pos" },
  { title: "Returns", href: "/app/returns", group: "Cashier", icon: "returns" },
  { title: "Inventory", href: "/app/inventory", group: "Catalog", icon: "inventory" },
  { title: "Accounting", href: "/app/accounting", group: "Back office", icon: "accounting" },
  { title: "HR", href: "/app/hr", group: "Back office", icon: "hr" },
  { title: "Reports", href: "/app/reports", group: "Back office", icon: "reports" },
  { title: "Notifications", href: "/app/notifications", group: "System", icon: "bell" },
  { title: "Settings", href: "/app/settings", group: "System", icon: "settings" },
] as const;

export const appNavGroups = [
  "Overview",
  "Cashier",
  "Catalog",
  "Back office",
  "System",
] as const;
