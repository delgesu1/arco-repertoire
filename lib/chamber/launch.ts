import { CHAMBER_ONLY_COMPOSERS } from "./chamber-only-composers";

/**
 * Whether the chamber section is public (docs/chamber-music-plan.md, phase 7): /chamber in the instrument switcher and the
 * sitemap, its pages indexed, composer pages listing chamber works, chamber-only composers with pages of their own.
 * NEXT_PUBLIC_CHAMBER_LIVE=0 hides it again (built but reachable only by its address, noindex) without a code change.
 */
export const CHAMBER_LIVE = process.env.NEXT_PUBLIC_CHAMBER_LIVE !== "0";

/** chamber works that are not also violin works have ids from 100001 (decision 4), so an address tells the sections apart */
export const CHAMBER_FIRST_ID = 100001;
const chamberComposers = new Set(CHAMBER_ONLY_COMPOSERS);
/**
 * Whether a page belongs to the chamber section (the header's switcher, search and Ask follow it): /chamber, the chamber-only
 * works' pages, and the pages of composers with chamber works only. A composer with violin works too keeps the violin header.
 */
export const isChamberPath = (path: string) =>
  path === "/chamber" ||
  Number(path.match(/^\/piece\/(\d+)/)?.[1] ?? 0) >= CHAMBER_FIRST_ID ||
  chamberComposers.has(path.match(/^\/composer\/([^/?#]+)/)?.[1] ?? "");
