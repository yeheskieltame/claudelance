import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://claudelance.vercel.app";

  return [
    { url: base, lastModified: new Date(), changeFrequency: "hourly", priority: 1 },
    { url: `${base}/bounties`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/revenue`, lastModified: new Date(), changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/docs`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/terms`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/privacy`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];
}
