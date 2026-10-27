/**
 * How famous a work is, for the lists' default "Best known" order (both sections; the build writes it as `fame`).
 *
 * The base is a 0–4 renown tier from Sonnet 5.5 (data/fame-tiers.json: every work marked well-known or left unmarked was rated;
 * 4 core canon, 3 standard repertoire, 2 known, 1 niche, 0 obscure). Works marked lesser-known have no tier and start at 0.
 * Ten points a tier, so the tier decides and the rest orders works within one: the views of the work's recordings
 * (3 points a factor of ten above 1,000, at most 12), exam syllabus listings and, in the chamber section, an approved benchmark.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const tiers: Record<string, number> = JSON.parse(readFileSync(join(__dirname, "..", "data/fame-tiers.json"), "utf8"));

export function fame(o: { id: number; popularity: string | null; views: number; examBoards?: number; benchmark?: boolean; penalty?: number }): number {
  const tier = tiers[String(o.id)];
  const base = tier != null ? tier * 10 : o.popularity === "lesser-known" ? 0 : 10;
  const views = o.views >= 1000 ? Math.min(12, (Math.log10(o.views) - 3) * 3) : 0;
  const exams = o.examBoards ? 3 + Math.min(o.examBoards, 4) : 0;
  return Math.round((base + views + exams + (o.benchmark ? 3 : 0) - (o.penalty ?? 0)) * 10) / 10;
}
