import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import LayoutWrapper from "@/components/layout/LayoutWrapper";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kaarobar — POS, Accounting & Workforce for Multi-Business Owners",
  description:
    "Unified point of sale, double-entry accounting, and HR/payroll for owners who run multiple businesses and branches—with Pakistan tax and FBR Tier-1 support.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
