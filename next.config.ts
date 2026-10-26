import { existsSync, readFileSync } from "node:fs";
import type { NextConfig } from "next";

// pieces merged into another entry keep working: data/id-redirects.json maps old id -> "newId/slug"
const idRedirects: Record<string, string> = existsSync("data/id-redirects.json")
  ? JSON.parse(readFileSync("data/id-redirects.json", "utf8"))
  : {};
// pieces whose title (and so address) was corrected: data/slug-redirects.json maps "id/oldSlug" -> "id/newSlug"
const slugRedirects: Record<string, string> = existsSync("data/slug-redirects.json")
  ? JSON.parse(readFileSync("data/slug-redirects.json", "utf8"))
  : {};

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // the old addresses forward to atlas.arco.app, path and all: the vercel.app one, and repertoire.arco.app (the site's
  // address until it was renamed Arco Atlas, 2026-10-26)
  async redirects() {
    return [
      ...["violinrep.vercel.app", "repertoire.arco.app"].map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        destination: "https://atlas.arco.app/:path*",
        permanent: true,
      })),
      ...Object.entries(idRedirects).map(([from, to]) => ({
        source: `/piece/${from}/:slug*`,
        destination: `/piece/${to}`,
        permanent: true,
      })),
      ...Object.entries(slugRedirects).map(([from, to]) => ({
        source: `/piece/${from}`,
        destination: `/piece/${to}`,
        permanent: true,
      })),
    ];
  },
  async headers() {
    return [
      {
        source: "/data/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
