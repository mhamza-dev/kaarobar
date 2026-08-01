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
  title: "Kaarobar | Sign in",
  description:
    "Sign in to Kaarobar Cloud (web, desktop, and mobile) by 2ndHub Solutions. Run POS, stock, books, and payroll for your shops.",
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
