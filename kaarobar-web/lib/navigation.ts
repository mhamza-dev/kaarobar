export const landingNav = [
  { title: "Solutions", href: "/#solutions" },
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
  { label: "Solutions", href: "/#solutions" },
  { label: "Modules", href: "/#modules" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Mobile App", href: "/#mobile" },
  { label: "FAQ", href: "/#faq" },
] as const;

export const solutionLinks = [
  { label: "Multi-business retail", href: "/#solutions" },
  { label: "Multi-branch POS", href: "/#modules" },
  { label: "Accounting & tax", href: "/#modules" },
  { label: "HR & payroll", href: "/#modules" },
  { label: "FBR Tier-1 ready", href: "/#faq" },
] as const;

export const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
] as const;

export const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "Cookie Policy", href: "/cookie-policy" },
] as const;

export const routes = {
  home: "/",
  login: "/login",
  signup: "/signup",
  forgotPassword: "/forgot-password",
  app: "/app",
  pos: "/app/pos",
  inventory: "/app/inventory",
  accounting: "/app/accounting",
  hr: "/app/hr",
  contact: "/contact",
  about: "/about",
  blog: "/blog",
  careers: "/careers",
  privacy: "/privacy-policy",
  terms: "/terms-of-service",
  cookies: "/cookie-policy",
} as const;

export const appNav = [
  { title: "Dashboard", href: "/app" },
  { title: "POS", href: "/app/pos" },
  { title: "Inventory", href: "/app/inventory" },
  { title: "Accounting", href: "/app/accounting" },
  { title: "HR", href: "/app/hr" },
] as const;
