import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/catalogue";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ["Googlebot", "Google-InspectionTool", "OAI-SearchBot", "ChatGPT-User"],
        allow: "/",
        disallow: "/api/",
      },
      {
        userAgent: "*",
        allow: [
          "/$",
          "/violin$", "/violin/$",
          "/chamber$", "/chamber/$",
          "/robots.txt$",
          "/opengraph-image$", "/opengraph-image?",
        ],
        disallow: "/",
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
