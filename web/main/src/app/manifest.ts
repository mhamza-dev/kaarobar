import type { MetadataRoute } from "next";

/**
 * Lets a shop install Kaarobar like an app — on the counter PC's taskbar or
 * a phone's home screen — opening straight onto the dashboard without the
 * browser's address bar.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kaarobar",
    short_name: "Kaarobar",
    description: "Run your shop, from the counter to the books.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f6f7fb",
    theme_color: "#2d6df6",
    categories: ["business", "finance", "productivity"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New sale", url: "/pos" },
      { name: "Sales", url: "/sales" },
      { name: "Products", url: "/products" },
    ],
  };
}
