import { redirect } from "next/navigation";
import { CHAMBER_LIVE } from "@/lib/chamber/launch";

/**
 * The site's address opens the chamber section; the violin list lives at /violin. An old link to the violin list with its
 * filters ("/?lv=5&exact=1", "/?piece=12", "/?ask=1") goes on to /violin with them.
 */
export default async function Root({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(await searchParams)) for (const x of [v ?? ""].flat()) sp.append(k, x);
  redirect(sp.size || !CHAMBER_LIVE ? `/violin${sp.size ? `?${sp}` : ""}` : "/chamber");
}
