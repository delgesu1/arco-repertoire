import type { NextConfig } from "next";

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
