"use client";

import { ReactNode, useEffect } from "react";
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

  const isAppShell = pathname.startsWith("/app");
  const showNavbar = !hideLayout;
  const showFooter = !hideLayout && !user;

  useEffect(() => {
    const root = document.documentElement;
    const { body } = document;
    if (isAppShell) {
      root.classList.add("h-dvh", "overflow-hidden");
      body.classList.add("h-dvh", "overflow-hidden");
      return () => {
        root.classList.remove("h-dvh", "overflow-hidden");
        body.classList.remove("h-dvh", "overflow-hidden");
      };
    }
    return undefined;
  }, [isAppShell]);

  return (
    <LocaleProvider>
      <ToastProvider>
        {showNavbar && <Navbar />}
        <main
          className={
            isAppShell
              ? "flex h-dvh min-h-0 flex-1 flex-col overflow-hidden"
              : "min-h-0 flex-1"
          }
        >
          {children}
        </main>
        {showFooter && <Footer />}
      </ToastProvider>
    </LocaleProvider>
  );
}
