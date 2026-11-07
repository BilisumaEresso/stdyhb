import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://webstudyhub.vercel.app";
  const now = new Date();

  // Core canonical static routes
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/explore`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.95,
    },
    {
      url: `${baseUrl}/subjects`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/help`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.8,
    },
  ];

  // Try fetching sample indexed resources to submit to Google
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://studyhubbot.onrender.com"
      : "http://localhost:5000");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${apiUrl}/api/search?limit=50`, {
      signal: controller.signal,
      next: { revalidate: 86400 }, // Cache for 24 hours
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (data && Array.isArray(data.data)) {
        const dynamicRoutes: MetadataRoute.Sitemap = data.data
          .filter((item: any) => item && item._id)
          .map((item: any) => ({
            url: `${baseUrl}/resource/${item._id}`,
            lastModified: item.updatedAt ? new Date(item.updatedAt) : now,
            changeFrequency: "weekly" as const,
            priority: 0.7,
          }));

        return [...staticRoutes, ...dynamicRoutes];
      }
    }
  } catch {
    // If backend is waking up or unreachable during build, safely return static routes
  }

  return staticRoutes;
}
