/**
 * Phase 4: checks the graders' files and writes the combined result into data/chamber/works.json.
 *
 *   npx tsx scripts/chamber/grading_apply.ts --check [chunk …]   # validate grade files against their chunks; writes nothing
 *   npx tsx scripts/chamber/grading_apply.ts                     # combine and write (refuses while grades are missing)
 *
 * Level: the median of the researcher's estimate (sources.json `levelGuess`), grader A and, where those two differ,
 * grader B. Hardest part: the graders' answer when both give the same part against the researcher's. Mode and pace:
 * the most common of the graders' answers ("unsure" is left blank); character: the first three words of either.
 * Benchmarks and works also in the violin catalogue are never changed.
 * Writes data/chamber/grading/result.json (per work: researcher, a, b, level, spread) for the record.
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberWork } from "../../lib/chamber/types";
import { CHARACTER } from "../../lib/vocab";

const ROOT = join(__dirname, "..", "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const DIR = "data/chamber/grading";
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const only = args.filter((a) => !a.startsWith("--"));

interface Grade {
  key: string;
  level: number;
  hardest: string;
  mode?: string;
  pace?: string;
  character?: string[];
  confidence?: string;
}
interface Item {
  key: string;
  parts: string[];
}

const chunkFiles = readdirSync(join(ROOT, DIR, "to-grade")).filter((f) => f.endsWith(".json")).sort();
const gradeFiles = new Set(readdirSync(join(ROOT, DIR, "grades")).filter((f) => f.endsWith(".json")));
const CHARS = new Set<string>(CHARACTER);
const problems: string[] = [];
const grades = { a: new Map<string, Grade>(), b: new Map<string, Grade>() };

for (const f of chunkFiles) {
  const chunk = f.replace(".json", "");
  if (only.length && !only.includes(chunk)) continue;
  const items = read<{ items: Item[] }>(`${DIR}/to-grade/${f}`).items;
  if (!gradeFiles.has(f)) {
    if (only.length || !checkOnly) problems.push(`${chunk}: no grade file yet`);
    continue;
  }
  const gs = read<{ grades: Grade[] }>(`${DIR}/grades/${f}`).grades;
  const byKey = new Map<string, Grade>();
  for (const g of gs) {
    if (byKey.has(g.key)) problems.push(`${chunk} ${g.key}: graded twice`);
    byKey.set(g.key, g);
  }
  for (const it of items) {
    const g = byKey.get(it.key);
    if (!g) {
      problems.push(`${chunk} ${it.key}: no grade`);
      continue;
    }
    if (!Number.isInteger(g.level) || g.level < 1 || g.level > 10) problems.push(`${chunk} ${it.key}: level ${g.level}`);
    if (g.hardest !== "balanced" && !it.parts.includes(g.hardest)) problems.push(`${chunk} ${it.key}: hardest "${g.hardest}" is not one of ${it.parts.join(", ")}`);
    if (g.mode && !["major", "minor", "unsure"].includes(g.mode)) problems.push(`${chunk} ${it.key}: mode "${g.mode}"`);
    if (g.pace && !["slow", "moderate", "lively"].includes(g.pace)) problems.push(`${chunk} ${it.key}: pace "${g.pace}"`);
    for (const c of g.character ?? []) if (!CHARS.has(c)) problems.push(`${chunk} ${it.key}: character "${c}"`);
    grades[chunk[0] as "a" | "b"].set(it.key, g);
  }
  const extra = gs.filter((g) => !items.some((it) => it.key === g.key));
  if (extra.length) problems.push(`${chunk}: ${extra.length} grades for keys not in the chunk`);
}

if (checkOnly) {
  console.log(`checked ${only.length ? only.join(", ") : `${gradeFiles.size} grade files`}: ${problems.length ? `${problems.length} problems` : "no problems"}`);
  for (const p of problems.slice(0, 60)) console.log(`  ${p}`);
  process.exit(problems.length ? 1 : 0);
}

const works = read<ChamberWork[]>("data/chamber/works.json");
const sources = read<Record<string, { levelGuess: number }>>("data/chamber/sources.json");
const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)];
const mostCommon = (xs: (string | undefined)[], ok: string[]) => {
  const c = new Map<string, number>();
  for (const x of xs) if (x && ok.includes(x)) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
};

const result: Record<number, { researcher: number; a: number; b: number | null; level: number; spread: number }> = {};
const pending: number[] = [];
const stats = { graded: 0, agreeA: 0, moved: 0, hardestChanged: 0, spread: new Map<number, number>() };
for (const w of works) {
  if (w.benchmark || w.violinId) continue;
  const k = String(w.id);
  const r = sources[k]?.levelGuess;
  const a = grades.a.get(k);
  if (r == null) throw new Error(`${w.id}: no researcher level in sources.json`);
  if (!a) {
    pending.push(w.id);
    continue;
  }
  const b = grades.b.get(k);
  if (a.level !== r && !b) {
    pending.push(w.id);
    continue;
  }
  const levels = b ? [r, a.level, b.level] : [r, a.level];
  const level = a.level === r ? r : median(levels);
  const spread = Math.max(...levels) - Math.min(...levels);
  stats.graded++;
  if (a.level === r) stats.agreeA++;
  if (level !== w.level) stats.moved++;
  stats.spread.set(spread, (stats.spread.get(spread) ?? 0) + 1);
  result[w.id] = { researcher: r, a: a.level, b: b?.level ?? null, level, spread };
  w.level = level;
  if (b && a.hardest === b.hardest && a.hardest !== w.hardestPart) {
    w.hardestPart = a.hardest;
    stats.hardestChanged++;
  }
  const gs = b ? [a, b] : [a];
  w.mode = mostCommon(gs.map((g) => g.mode), ["major", "minor"]) as ChamberWork["mode"];
  w.pace = mostCommon(gs.map((g) => g.pace), ["slow", "moderate", "lively"]) as ChamberWork["pace"];
  w.character = [...new Set(gs.flatMap((g) => g.character ?? []).filter((c) => CHARS.has(c)))].slice(0, 3);
}

if (problems.length || pending.length) {
  console.log(`not written: ${problems.length} problems in grade files, ${pending.length} works still waiting for a grade (first: ${pending.slice(0, 5).join(", ")})`);
  for (const p of problems.slice(0, 40)) console.log(`  ${p}`);
  process.exit(1);
}
writeFileSync(join(ROOT, "data/chamber/works.json"), JSON.stringify(works, null, 1) + "\n");
writeFileSync(join(ROOT, DIR, "result.json"), JSON.stringify(result, null, 1) + "\n");
console.log(
  `${stats.graded} works graded; grader A agreed with the researcher on ${stats.agreeA} (${Math.round((100 * stats.agreeA) / stats.graded)}%); ` +
    `${stats.moved} levels changed; ${stats.hardestChanged} hardest parts changed; spread of the opinions: ` +
    [...stats.spread.entries()].sort((x, y) => x[0] - y[0]).map(([s, n]) => `${s}: ${n}`).join(", "),
);
