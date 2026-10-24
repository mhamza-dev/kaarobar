import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// No `title` here on purpose: each screen renders its own <title> (see
// PageHeader and AuthShell), and a default from metadata is re-inserted
// ahead of it on every client-side navigation, where the browser would
// show it instead.
export const metadata: Metadata = {
  description: "Kaarobar — run your shop, from the counter to the books.",
  applicationName: "Kaarobar",
  appleWebApp: { capable: true, title: "Kaarobar", statusBarStyle: "default" },
  // A shop's own records are nobody's search result.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ebeef4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e18" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
