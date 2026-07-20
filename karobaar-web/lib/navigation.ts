export const landingNav = [
  { title: "Features", href: "/#features" },
  { title: "Solutions", href: "/#solutions" },
  { title: "Modules", href: "/#modules" },
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
  { label: "Features", href: "/#features" },
  { label: "Modules", href: "/#modules" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Mobile App", href: "/#mobile" },
  { label: "FAQ", href: "/#faq" },
] as const;

export const solutionLinks = [
  { label: "Retail", href: "/#solutions" },
  { label: "Wholesale", href: "/#solutions" },
  { label: "Restaurants", href: "/#solutions" },
  { label: "Manufacturing", href: "/#solutions" },
  { label: "Pharmacy", href: "/#solutions" },
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
  contact: "/contact",
  about: "/about",
  blog: "/blog",
  careers: "/careers",
  privacy: "/privacy-policy",
  terms: "/terms-of-service",
  cookies: "/cookie-policy",
} as const;
