"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { QueryClientProvider } from "@tanstack/react-query";

import { LocaleProvider } from "@/lib/i18n";
import { makeQueryClient } from "@/lib/queryClient";
import { ToastProvider } from "@/components/ui/Toast";

interface LayoutWrapperProps {
  children: ReactNode;
}

export default function LayoutWrapper({ children }: LayoutWrapperProps) {
  const pathname = usePathname();
  const [queryClient] = useState(() => makeQueryClient());
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
    <QueryClientProvider client={queryClient}>
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
    </QueryClientProvider>
  );
}
