import type { MetadataRoute } from "next";

const BASE = "https://claudelance.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, priority: 1 },
    { url: `${BASE}/bounties`, lastModified: now, priority: 0.9 },
    { url: `${BASE}/post`, lastModified: now, priority: 0.8 },
    { url: `${BASE}/workers`, lastModified: now, priority: 0.7 },
    { url: `${BASE}/revenue`, lastModified: now, priority: 0.6 },
    { url: `${BASE}/about`, lastModified: now, priority: 0.5 },
  ];
}
