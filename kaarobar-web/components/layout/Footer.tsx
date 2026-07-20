"use client";

import Link from "next/link";
import { Mail, MapPin, Phone, ArrowUpRight } from "lucide-react";

import {
  FaFacebookF,
  FaGithub,
  FaInstagram,
  FaLinkedinIn,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

import {
  companyLinks,
  legalLinks,
  productLinks,
  routes,
  solutionLinks,
} from "@/lib/navigation";

const socials = [
  { icon: FaFacebookF, href: "https://facebook.com", label: "Facebook" },
  { icon: FaInstagram, href: "https://instagram.com", label: "Instagram" },
  { icon: FaLinkedinIn, href: "https://linkedin.com", label: "LinkedIn" },
  { icon: FaXTwitter, href: "https://x.com", label: "X" },
  { icon: FaGithub, href: "https://github.com", label: "GitHub" },
];

export default function Footer() {
  return (
    <footer className="border-t border-border bg-sidebar text-white">
      <div className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Link href={routes.home} className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-md bg-brand text-2xl font-bold">
                K
              </div>

              <div>
                <h2 className="text-2xl font-bold text-white">Kaarobar</h2>
                <p className="text-sm text-slate-400">
                  POS · Accounting · Payroll
                </p>
              </div>
            </Link>

            <p className="mt-8 max-w-lg leading-8 text-slate-400">
              Kaarobar helps owners run POS, books, and payroll across more than
              one business and branch—built for Pakistan, with FBR Tier-1 when
              you need it.
            </p>

            <div className="mt-8 space-y-4">
              <a
                href="mailto:support@kaarobar.com"
                className="flex items-center gap-3 text-slate-400 transition hover:text-white"
              >
                <Mail size={18} />
                <span>support@kaarobar.com</span>
              </a>

              <a
                href="tel:+923001234567"
                className="flex items-center gap-3 text-slate-400 transition hover:text-white"
              >
                <Phone size={18} />
                <span>+92 300 1234567</span>
              </a>

              <div className="flex items-center gap-3 text-slate-400">
                <MapPin size={18} />
                <span>Pakistan • Available Worldwide</span>
              </div>
            </div>

            <div className="mt-10 flex gap-4">
              {socials.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="flex h-11 w-11 items-center justify-center rounded-md bg-sidebar-hover transition-all duration-300 hover:-translate-y-1 hover:bg-brand"
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-white">Product</h3>
            <ul className="mt-6 space-y-4">
              {productLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between text-slate-400 transition hover:text-white"
                  >
                    {item.label}
                    <ArrowUpRight
                      size={14}
                      className="opacity-0 transition group-hover:opacity-100"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h3 className="text-lg font-semibold text-white">Solutions</h3>
            <ul className="mt-6 space-y-4">
              {solutionLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between text-slate-400 transition hover:text-white"
                  >
                    {item.label}
                    <ArrowUpRight
                      size={14}
                      className="opacity-0 transition group-hover:opacity-100"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-3">
            <h3 className="text-lg font-semibold text-white">Company</h3>
            <ul className="mt-6 space-y-4">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between text-slate-400 transition hover:text-white"
                  >
                    {item.label}
                    <ArrowUpRight
                      size={14}
                      className="opacity-0 transition group-hover:opacity-100"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="my-12 border-t border-slate-800" />

        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} Kaarobar. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-6 text-sm">
            {legalLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="text-slate-500 transition hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
