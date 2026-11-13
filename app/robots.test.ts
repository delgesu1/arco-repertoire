import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("Atlas crawler policy", () => {
  it("keeps the catalog discoverable by Google and ChatGPT search", () => {
    const policy = robots();
    expect(policy.rules).toContainEqual({
      userAgent: ["Googlebot", "Google-InspectionTool", "OAI-SearchBot", "ChatGPT-User"],
      allow: "/",
      disallow: "/api/",
    });
    expect(policy.sitemap).toBe("https://atlas.arco.app/sitemap.xml");
  });

  it("limits other crawlers to exact entry pages and their shared preview image", () => {
    expect(robots().rules).toContainEqual({
      userAgent: "*",
      allow: [
        "/$", "/violin$", "/violin/$", "/chamber$", "/chamber/$",
        "/robots.txt$", "/opengraph-image$", "/opengraph-image?",
      ],
      disallow: "/",
    });
  });
});
