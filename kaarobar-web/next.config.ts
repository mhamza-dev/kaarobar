import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      // Never expose internal filesystem segment in the browser
      { source: "/workspace", destination: "/app", permanent: false },
      { source: "/workspace/:path*", destination: "/app/:path*", permanent: false },
      { source: "/portal", destination: "/login?as=consumer", permanent: false },
      { source: "/portal/login", destination: "/login?as=consumer", permanent: false },
      { source: "/portal/register", destination: "/signup?as=consumer", permanent: false },
      { source: "/portal/reset", destination: "/login?as=consumer", permanent: false },
      { source: "/portal/market", destination: "/app", permanent: false },
      { source: "/portal/market/:id", destination: "/app/market/:id", permanent: false },
      { source: "/portal/orders", destination: "/app/sales", permanent: false },
      { source: "/portal/loyalty", destination: "/app/customers", permanent: false },
      { source: "/portal/ar", destination: "/app/accounting", permanent: false },
      { source: "/portal/:path*", destination: "/login?as=consumer", permanent: false },
      { source: "/app/orders", destination: "/app/sales", permanent: false },
      { source: "/app/loyalty", destination: "/app/customers", permanent: false },
      { source: "/app/ar", destination: "/app/accounting", permanent: false },
      { source: "/app/market", destination: "/app", permanent: false },
      { source: "/login", has: [{ type: "query", key: "as", value: "buyer" }], destination: "/login?as=consumer", permanent: false },
      { source: "/signup", has: [{ type: "query", key: "as", value: "buyer" }], destination: "/signup?as=consumer", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/app", destination: "/workspace" },
      { source: "/app/:path*", destination: "/workspace/:path*" },
    ];
  },
};

export default nextConfig;
