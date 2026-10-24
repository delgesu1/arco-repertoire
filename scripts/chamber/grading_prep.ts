/**
 * Phase 4 (docs/chamber-music-plan.md): blind grading of the curated works.
 *
 * The final level of a work is the median of three opinions: the curation researcher's estimate (in
 * data/chamber/sources.json, never shown to graders), grader A, and grader B. When the researcher and grader A agree,
 * grader B cannot change the median, so B only grades the works where they differ.
 *
 *   npx tsx scripts/chamber/grading_prep.ts a          # chunks for grader A: every curated work without a settled level
 *   npx tsx scripts/chamber/grading_prep.ts b          # chunks for grader B: the works where grader A differs from the researcher
 *
 * Writes data/chamber/grading/anchors.json (the scale, the vocabulary, violin anchors and the 135 benchmarks) and
 * data/chamber/grading/to-grade/<a|b><nn>.json. Graders write data/chamber/grading/grades/<chunk>.json
 * (brief: data/chamber/grading/GRADER_BRIEF.md); scripts/chamber/grading_apply.ts combines them.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberWork } from "../../lib/chamber/types";
import { FORMATIONS, instrumentList } from "../../lib/chamber/vocab";
import type { Catalogue } from "../../lib/types";

const ROOT = join(__dirname, "..", "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const DIR = "data/chamber/grading";
const CHUNK = 250;
const pass = process.argv[2];
if (pass !== "a" && pass !== "b") throw new Error("usage: grading_prep.ts a|b");

const works = read<ChamberWork[]>("data/chamber/works.json");
const sources = read<Record<string, { levelGuess?: number }>>("data/chamber/sources.json");
const violin = read<Catalogue>("data/build/catalogue.json");
const label = (k: string) => FORMATIONS.find((f) => f.key === k)?.label ?? k;
const parts = (ins: Record<string, number>) =>
  Object.entries(ins)
    .filter(([k]) => k !== "electronics")
    .flatMap(([k, n]) => (n > 1 ? Array.from({ length: n }, (_, i) => `${k} ${i + 1}`) : [k]));

// ---------------------------------------------------------------- anchors (shared by every chunk)
const pick = (lv: number, n: number) => {
  const seen = new Set<string>();
  return violin.pieces
    .filter((p) => p.level === lv && p.popularity === "well-known" && ["sonata", "duet", "concerto", "solo", "short"].includes(p.type))
    .sort((a, b) => Number(b.type === "sonata" || b.type === "duet") - Number(a.type === "sonata" || a.type === "duet") || a.id - b.id)
    .filter((p) => (seen.has(p.composer) ? false : (seen.add(p.composer), true)))
    .slice(0, n)
    .map((p) => `${p.level} | ${p.composer} — ${p.title} (${p.accompaniment})`);
};
mkdirSync(join(ROOT, DIR, "to-grade"), { recursive: true });
mkdirSync(join(ROOT, DIR, "grades"), { recursive: true });
writeFileSync(
  join(ROOT, DIR, "anchors.json"),
  JSON.stringify(
    {
      levels: violin.levels,
      definition:
        "A chamber work's level is the level, on this 1–10 scale, that its hardest part asks of its player, raised by up to one level when holding the ensemble together (coordination, exposed intonation, stamina, balance) is harder than the notes. For a part on another instrument, read the scale as the same exam grade on that instrument: level 4 is about ABRSM grade 7 piano, cello, flute or viol. Grade the whole work as usually performed, not its hardest bar.",
      vocabulary: {
        mode: ["major", "minor", "unsure"],
        pace: ["slow", "moderate", "lively"],
        character: ["lyrical", "dance", "virtuosic", "playful", "dramatic", "tender", "dark", "folk", "heroic", "humorous"],
      },
      violinAnchors: violin.levels.flatMap((l) => pick(l.level, 6)),
      chamberBenchmarks: works
        .filter((w) => w.benchmark)
        .map((w) => `${w.level} | ${w.composer} — ${w.title} (${instrumentList(w.instruments)}; hardest: ${w.hardestPart})`),
    },
    null,
    1,
  ) + "\n",
);

// ---------------------------------------------------------------- items
const item = (w: ChamberWork) => ({
  key: String(w.id),
  composer: w.composer,
  title: w.title,
  formation: label(w.formation),
  scoring: instrumentList(w.instruments, { alternatives: w.alternatives, optional: w.optional }),
  parts: parts(w.instruments),
  year: w.year,
  minutes: w.minutes ?? 0,
  set: w.set ?? "",
  notes: w.notes,
});

let todo: ChamberWork[];
if (pass === "a") {
  // settled: benchmarks, and works also in the violin catalogue (they keep the violin level)
  todo = works.filter((w) => !w.benchmark && !w.violinId);
} else {
  const gradesDir = join(ROOT, DIR, "grades");
  const a = new Map<string, number>();
  for (const f of readdirSync(gradesDir).filter((f) => f.startsWith("a") && f.endsWith(".json")))
    for (const g of JSON.parse(readFileSync(join(gradesDir, f), "utf8")).grades) a.set(g.key, g.level);
  const missing = works.filter((w) => !w.benchmark && !w.violinId && !a.has(String(w.id)));
  if (missing.length) throw new Error(`${missing.length} works have no grade from grader A yet (first: ${missing[0].id})`);
  todo = works.filter((w) => !w.benchmark && !w.violinId && a.get(String(w.id)) !== sources[w.id]?.levelGuess);
}
// keep one composer's works together where possible: they are graded more consistently side by side
todo.sort((x, y) => x.composer.localeCompare(y.composer) || x.id - y.id);
const chunks = Math.ceil(todo.length / CHUNK);
for (let i = 0; i < chunks; i++) {
  const name = `${pass}${String(i + 1).padStart(2, "0")}`;
  const path = join(ROOT, DIR, "to-grade", `${name}.json`);
  if (existsSync(path) && pass === "a") continue; // never reshuffle chunks a grader may already be working on
  writeFileSync(path, JSON.stringify({ chunk: name, items: todo.slice(i * CHUNK, (i + 1) * CHUNK).map(item) }, null, 1) + "\n");
}
console.log(`pass ${pass}: ${todo.length} works in ${chunks} chunks of up to ${CHUNK}`);
