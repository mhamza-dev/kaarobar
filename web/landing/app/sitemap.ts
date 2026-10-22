import type { MetadataRoute } from "next";

import { site } from "@/lib/site";

const pages = ["", "/features", "/industries", "/pricing", "/download", "/about", "/contact", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return pages.map((path) => ({
    url: `${site.url}${path}`,
    changeFrequency: path === "/pricing" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/pricing" ? 0.9 : 0.7,
  }));
}
