"use client";

import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";

import { LocaleProvider } from "@/lib/i18n";
import { ToastProvider } from "@/components/ui/Toast";

interface LayoutWrapperProps {
  children: ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const isAppShell =
    pathname.startsWith("/app") || pathname.startsWith("/workspace");

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
        <main
          className={
            isAppShell
              ? "flex h-dvh min-h-0 flex-1 flex-col overflow-hidden"
              : "min-h-0 flex-1"
          }
        >
          {children}
        </main>
      </ToastProvider>
    </LocaleProvider>
  );
}
