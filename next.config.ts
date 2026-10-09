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
  // the old vercel.app address forwards to the Arco domain
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "violinrep.vercel.app" }],
        destination: "https://repertoire.arco.app/:path*",
        permanent: true,
      },
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
