import type { MetadataRoute } from "next";
import { composers, pieces, SITE_URL } from "@/lib/catalogue";
import { chamberOnly } from "@/lib/chamber/catalogue";
import { CHAMBER_LIVE } from "@/lib/chamber/launch";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/violin`, priority: 0.9 },
    { url: `${SITE_URL}/levels`, priority: 0.6 },
    { url: `${SITE_URL}/composers`, priority: 0.6 },
    ...composers.map((c) => ({ url: `${SITE_URL}/composer/${c.slug}`, priority: 0.5 })),
    ...pieces.map((p) => ({ url: `${SITE_URL}/piece/${p.id}/${p.slug}`, priority: 0.7 })),
    // the chamber section joins at launch (lib/chamber/launch.ts)
    ...(CHAMBER_LIVE ? chamberSitemap() : []),
  ];
}

function chamberSitemap(): MetadataRoute.Sitemap {
  const violinComposers = new Set(composers.map((c) => c.slug));
  const newComposers = new Set(chamberOnly.map((p) => p.composerSlug).filter((s) => !violinComposers.has(s)));
  return [
    // the site's address opens the chamber section (app/page.tsx)
    { url: `${SITE_URL}/chamber`, priority: 1 },
    ...[...newComposers].map((slug) => ({ url: `${SITE_URL}/composer/${slug}`, priority: 0.5 })),
    ...chamberOnly.map((p) => ({ url: `${SITE_URL}/piece/${p.id}/${p.slug}`, priority: 0.7 })),
  ];
}
