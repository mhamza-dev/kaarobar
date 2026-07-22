"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { LocaleProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ui/Toast";

interface LayoutWrapperProps {
  children: ReactNode;
}

const HIDDEN_LAYOUT_ROUTES = ["/login", "/signup", "/forgot-password"];

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const user = null;

  const hideLayout =
    HIDDEN_LAYOUT_ROUTES.includes(pathname) ||
    pathname.startsWith("/app") ||
    pathname.startsWith("/portal");

  const showNavbar = !hideLayout;
  const showFooter = !hideLayout && !user;

  return (
    <LocaleProvider>
      <ToastProvider>
        {showNavbar && <Navbar />}
        <main
          className={
            pathname.startsWith("/app")
              ? "flex h-dvh min-h-0 flex-1 flex-col overflow-hidden"
              : "flex-1"
          }
        >
          {children}
        </main>
        {showFooter && <Footer />}
      </ToastProvider>
    </LocaleProvider>
  );
}
