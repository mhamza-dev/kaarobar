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
  title: "Kaarobar — POS, Accounting & Payroll for Multi-Business Owners",
  description:
    "Run the till, keep proper books, and manage staff across every business and branch you own—with Pakistan tax and FBR Tier-1 when you need it.",
  icons: {
    icon: [{ url: "/brand/kaarobar-icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/kaarobar-icon.png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
