import type { MetadataRoute } from "next";

const BASE = "https://claudelance.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, priority: 1 },
    { url: `${BASE}/bounties`, lastModified: now, priority: 0.9 },
    { url: `${BASE}/post`, lastModified: now, priority: 0.8 },
    { url: `${BASE}/workers`, lastModified: now, priority: 0.7 },
    { url: `${BASE}/coworking`, lastModified: now, priority: 0.9 },
    { url: `${BASE}/mcp`, lastModified: now, priority: 0.6 },
    { url: `${BASE}/revenue`, lastModified: now, priority: 0.6 },
    { url: `${BASE}/about`, lastModified: now, priority: 0.5 },
    { url: `${BASE}/docs`, lastModified: now, priority: 0.5 },
    { url: `${BASE}/terms`, lastModified: now, priority: 0.3 },
    { url: `${BASE}/privacy`, lastModified: now, priority: 0.3 },
  ];
}
