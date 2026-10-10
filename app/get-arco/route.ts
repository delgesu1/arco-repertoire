import { NextResponse, type NextRequest } from "next/server";
import { appStoreUrl, arcoWebUrl, type Placement } from "@/lib/arco";

export const dynamic = "force-dynamic";

const PLACEMENTS = new Set<string>(["piece", "footer", "peek", "banner"]);

/** iPhone → App Store page, everyone else → arco.app/start. The placement stays in the destination's tags. */
export function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("from") ?? "";
  const from = (PLACEMENTS.has(raw) ? raw : "site") as Placement;
  const ios = /iPhone|iPad|iPod/.test(req.headers.get("user-agent") ?? "");
  const res = NextResponse.redirect(ios ? appStoreUrl(from) : arcoWebUrl(from), 302);
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}
