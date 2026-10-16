/**
 * The chamber section is built but hidden until launch (docs/chamber-music-plan.md, phase 7): /chamber is not in the
 * instrument switcher or the sitemap, its pages are noindex, and composer pages show violin works only.
 * Launch by setting this to true; NEXT_PUBLIC_CHAMBER_LIVE=1 previews the launched site locally.
 */
export const CHAMBER_LIVE = process.env.NEXT_PUBLIC_CHAMBER_LIVE === "1";

/** chamber works that are not also violin works have ids from 100001 (decision 4), so an address tells the sections apart */
export const CHAMBER_FIRST_ID = 100001;
export const isChamberPath = (path: string) =>
  path === "/chamber" || Number(path.match(/^\/piece\/(\d+)/)?.[1] ?? 0) >= CHAMBER_FIRST_ID;
