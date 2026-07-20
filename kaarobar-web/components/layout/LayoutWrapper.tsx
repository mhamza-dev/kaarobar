"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { LocaleProvider } from "@/lib/i18n";

interface LayoutWrapperProps {
  children: ReactNode;
}

const HIDDEN_LAYOUT_ROUTES = ["/login", "/signup", "/forgot-password"];

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const user = null;

  const hideLayout =
    HIDDEN_LAYOUT_ROUTES.includes(pathname) || pathname.startsWith("/app");

  const showNavbar = !hideLayout;
  const showFooter = !hideLayout && !user;

  return (
    <LocaleProvider>
      {showNavbar && <Navbar />}
      <main className="flex-1">{children}</main>
      {showFooter && <Footer />}
    </LocaleProvider>
  );
}
