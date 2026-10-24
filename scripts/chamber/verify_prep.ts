/**
 * Phase 5 (docs/chamber-music-plan.md): the tiered fact-check of the curated works.
 *
 *   tier 1  works whose IMSLP page disagrees with them (scripts/chamber/imslp_crosscheck.ts)
 *   tier 2  works at medium or low confidence, with only one source, or with no IMSLP page
 *   tier 3  a random sample of 300 of the rest, to measure their error rate
 * Benchmarks (checked in phase 0) and works also in the violin catalogue are left out.
 *
 *   npx tsx scripts/chamber/verify_prep.ts
 * writes data/chamber/verify/to-check/<chunk>.json (CHUNK works each, one composer's works together) and prints the counts.
 * Agents follow data/chamber/verify/BRIEF.md and write data/chamber/verify/checked/<chunk>.json; scripts/chamber/verify_apply.ts applies them.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberWork } from "../../lib/chamber/types";

const ROOT = join(__dirname, "..", "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const CHUNK = 50;
const SAMPLE = 300;

const works = read<ChamberWork[]>("data/chamber/works.json");
const sources = read<Record<string, { slice: string; confidence: string; sources: string[]; floor: Record<string, string>; gap: boolean }>>("data/chamber/sources.json");
const cross = read<Record<string, { flags: { field: string; ours: unknown; imslp: unknown }[] }>>("data/chamber/verify/imslp-crosscheck.json");

// a seeded shuffle, so the sample is the same on every run
let seed = 20261023;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const tier = (w: ChamberWork) => {
  const s = sources[w.id];
  if (cross[w.id]) return 1;
  if (s.confidence !== "high" || s.sources.length < 2 || !w.imslpPage) return 2;
  return 3;
};
const pool = works.filter((w) => !w.benchmark && !w.violinId);
const t1 = pool.filter((w) => tier(w) === 1);
const t2 = pool.filter((w) => tier(w) === 2);
const rest = pool.filter((w) => tier(w) === 3);
const t3 = rest
  .map((w) => ({ w, r: rand() }))
  .sort((a, b) => a.r - b.r)
  .slice(0, SAMPLE)
  .map((x) => x.w);

const todo = [...t1, ...t2, ...t3].sort((x, y) => x.composer.localeCompare(y.composer) || x.id - y.id);
const tierOf = new Map([...t1.map((w) => [w.id, 1]), ...t2.map((w) => [w.id, 2]), ...t3.map((w) => [w.id, 3])] as [number, number][]);
mkdirSync(join(ROOT, "data/chamber/verify/to-check"), { recursive: true });
mkdirSync(join(ROOT, "data/chamber/verify/checked"), { recursive: true });
const chunks = Math.ceil(todo.length / CHUNK);
for (let i = 0; i < chunks; i++) {
  const name = `v${String(i + 1).padStart(3, "0")}`;
  const path = join(ROOT, "data/chamber/verify/to-check", `${name}.json`);
  if (existsSync(path)) continue; // never reshuffle a chunk an agent may be working on
  const items = todo.slice(i * CHUNK, (i + 1) * CHUNK).map((w) => {
    // level, hardest part, popularity and tags are not the checker's job, so they are left out of its file
    const facts = Object.fromEntries(
      Object.entries(w).filter(([k]) => !["benchmark", "basis", "level", "hardestPart", "mode", "pace", "character", "popularity"].includes(k)),
    );
    const s = sources[w.id];
    return {
      ...facts,
      tier: tierOf.get(w.id),
      evidence: { confidence: s.confidence, sources: s.sources, floor: s.floor, gapCheck: s.gap },
      ...(cross[w.id] ? { imslpMismatch: cross[w.id].flags } : {}),
    };
  });
  writeFileSync(path, JSON.stringify({ chunk: name, items }, null, 1) + "\n");
}
console.log(`tier 1: ${t1.length}, tier 2: ${t2.length}, tier 3 sample: ${t3.length} of ${rest.length}; ${todo.length} works in ${chunks} chunks of up to ${CHUNK}`);
