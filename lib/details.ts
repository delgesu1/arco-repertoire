import type { PieceBase } from "./types";

/**
 * What the site knows about a work beyond the catalogue row: its movements, when it was composed, its dedication and
 * first performance, other titles (from IMSLP, then research; scripts/details_merge.py writes public/data/details.json).
 */
export interface WorkDetails {
  movements?: string[];
  /** "movements" (or IMSLP's "sections", "parts" …), "pieces" for a set, "single" for one movement */
  kind?: string;
  composed?: string;
  dedication?: string;
  firstPerformance?: string;
  published?: string;
  otherTitles?: string[];
}

/** movements are numbered I, II, III; the pieces of a set 1, 2, 3 */
export const isMovementList = (d: WorkDetails) => !d.kind || /^(movement|section|part|tempo)/.test(d.kind);

const ROMAN: [number, string][] = [[50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function roman(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN)
    while (n >= v) {
      out += s;
      n -= v;
    }
  return out;
}

/**
 * The work's title as a concert program prints it. The violin catalogue leaves the violin implicit ("Concerto in E minor,
 * Op. 64"); a program says "Violin Concerto in E minor, Op. 64". Chamber titles already name their ensemble.
 */
export function programTitle(p: PieceBase & { type?: string; settings?: string[] }): string {
  if (!p.type || /\bfor\b/i.test(p.title)) return p.title;
  if (p.type === "concerto" && /^Concerto\b/.test(p.title)) return `Violin ${p.title}`;
  if (p.type === "sonata" && /^Sonata\b/.test(p.title) && p.settings?.some((s) => s === "piano" || s === "continuo")) return `Violin ${p.title}`;
  return p.title;
}

/** Composer, program title, arranger when credited, then the movements. */
export function programText(p: PieceBase & { type?: string; settings?: string[] }, d?: WorkDetails | null): string {
  const lines = [`${p.composerName}${p.dates ? ` (${p.dates})` : ""}`, programTitle(p)];
  if (p.arranger) lines.push(`arr. ${p.arranger}`);
  if (d?.movements?.length) {
    const roman_ = isMovementList(d);
    d.movements.forEach((m, i) => lines.push(`${roman_ ? roman(i + 1) : i + 1}. ${m}`));
  }
  return lines.join("\n");
}

// the sheet's copy of the details, fetched once when a piece is first opened
let cache: Promise<Record<string, WorkDetails>> | null = null;
export const loadDetails = (): Promise<Record<string, WorkDetails>> =>
  (cache ??= fetch("/data/details.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({})));
