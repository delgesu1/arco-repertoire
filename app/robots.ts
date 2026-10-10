import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/catalogue";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/get-arco"] }], sitemap: `${SITE_URL}/sitemap.xml` };
}
