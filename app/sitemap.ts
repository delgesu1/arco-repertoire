import type { MetadataRoute } from "next";
import { composers, pieces, SITE_URL } from "@/lib/catalogue";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, priority: 1 },
    { url: `${SITE_URL}/levels`, priority: 0.6 },
    { url: `${SITE_URL}/composers`, priority: 0.6 },
    ...composers.map((c) => ({ url: `${SITE_URL}/composer/${c.slug}`, priority: 0.5 })),
    ...pieces.map((p) => ({ url: `${SITE_URL}/piece/${p.id}/${p.slug}`, priority: 0.7 })),
  ];
}
