/**
 * Merges the curation agents' slices (data/chamber/curation/out/*.json) into the chamber catalogue.
 *
 *   data/chamber/works.json        the 135 benchmarks stay as they are (with the owner-approved corrections below);
 *                                  every other kept work is added, in slice order
 *   data/chamber/composers.json    gains the slice authors who are not in the violin catalogue
 *   data/chamber/id-registry.json  "composer|title" -> id, so a re-run gives every work the same id
 *   data/chamber/sources.json      per id: slice, confidence, sources, floor evidence, the researcher's level basis
 *                                  (kept out of works.json: phase 5 verifies from it; blind graders must not see it)
 *
 * Works also in the violin catalogue take their title, level and descriptive fields from the violin row.
 * Re-runnable: it always starts from the benchmarks. Check the result with `npx tsx scripts/chamber/check.ts`.
 *   npx tsx scripts/chamber/merge_curation.ts [--dry]
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberComposer, ChamberWork, FormKey, FormationKey, InstrumentKey } from "../../lib/chamber/types";
import type { Catalogue, EraKey, Piece } from "../../lib/types";

const ROOT = join(__dirname, "..", "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const write = (p: string, v: unknown) => writeFileSync(join(ROOT, p), JSON.stringify(v, null, 1) + "\n");
const dry = process.argv.includes("--dry");

interface OutWork {
  composer: string;
  title: string;
  aka?: string[];
  instruments: Partial<Record<InstrumentKey, number>>;
  alternatives?: Partial<Record<InstrumentKey, InstrumentKey[]>>;
  optional?: Partial<Record<InstrumentKey, number>>;
  players: number;
  formation: FormationKey;
  formationNote?: string | null;
  form: FormKey;
  set: string | null;
  year: string;
  minutes: number | null;
  notes: string;
  popularity: "well-known" | "lesser-known";
  level_guess: number;
  level_basis?: string;
  hardest_part_guess: string;
  imslpPage: string | null;
  benchmark_id?: number | null;
  violin_id?: number | null;
  floor?: Record<string, string>;
  sources: string[];
  confidence: string;
  gap?: boolean;
}
interface OutFile {
  slice: string;
  authors?: { name: string; dates: string; nationality: string; gender: string; era: EraKey }[];
  works: OutWork[];
}

// benchmark corrections the curation agents reported and the owner approved (2026-10-17, data/chamber/curation/README.md)
const BENCHMARK_FIXES: Record<number, (w: ChamberWork) => void> = {
  100012: (w) => void (w.minutes = 5), // Purcell, Chacony: one-to-a-part recordings run 4:24-4:47
  100036: (w) => void (w.minutes = 36), // Dvořák, Cypresses: IMSLP average 36, Stamitz Quartet 36:39
  100060: (w) => void (w.minutes = 7), // Piazzolla, Four, for Tango: recordings 6:41-6:46, Lemoine score 7:00
  100114: (w) => void (w.minutes = 30), // Farrenc, Nonet: IMSLP 30, recordings 29-31
  100066: (w) => {
    w.set = "Six String Quintets, Op. 11";
    w.aka = [...new Set([...(w.aka ?? []), "Op. 13 No. 5"])]; // the old Pleyel numbering of most recordings
  },
  100067: (w) => {
    w.set = "Six String Quintets, Op. 30";
    w.aka = [...new Set([...(w.aka ?? []), "Quintettino, Op. 30 No. 6"])];
  },
};

const violin = read<Catalogue>("data/build/catalogue.json").pieces;
const violinById = new Map<number, Piece>(violin.map((p) => [p.id, p]));
const violinComposers = new Set(violin.map((p) => p.composer));

const benchmarks = read<ChamberWork[]>("data/chamber/works.json").filter((w) => w.benchmark);
for (const w of benchmarks) BENCHMARK_FIXES[w.id]?.(w);

const composers = read<Record<string, ChamberComposer>>("data/chamber/composers.json");
const registry: Record<string, number> = existsSync(join(ROOT, "data/chamber/id-registry.json"))
  ? read("data/chamber/id-registry.json")
  : {};
const key = (composer: string, title: string) => `${composer}|${title}`;
for (const w of benchmarks) registry[key(w.composer, w.title)] = w.id;
let nextId = Math.max(...Object.values(registry)) + 1;

const dir = "data/chamber/curation/out";
const files = readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".json")).sort();
const added: ChamberWork[] = [];
const sources: Record<number, unknown> = {};
const seen = new Set(benchmarks.map((w) => key(w.composer, w.title)));
const report = { slices: files.length, benchmarksSkipped: 0, crossListed: 0, crossTitleFixed: [] as string[], duplicates: [] as string[], newComposers: 0, composerConflicts: [] as string[] };

for (const f of files) {
  const d = read<OutFile>(`${dir}/${f}`);
  for (const a of d.authors ?? []) {
    if (violinComposers.has(a.name)) continue;
    const meta: ChamberComposer = { dates: a.dates, nationality: a.nationality, gender: (a.gender === "Female" ? "F" : a.gender === "Male" ? "M" : a.gender) as ChamberComposer["gender"], era: a.era };
    const old = composers[a.name];
    if (!old) {
      composers[a.name] = meta;
      report.newComposers++;
    } else if (JSON.stringify(old) !== JSON.stringify(meta)) report.composerConflicts.push(`${a.name} (${d.slice}): kept ${JSON.stringify(old)}, slice says ${JSON.stringify(meta)}`);
  }
  for (const o of d.works) {
    if (o.benchmark_id) {
      report.benchmarksSkipped++;
      continue;
    }
    const v = o.violin_id ? violinById.get(o.violin_id) : undefined;
    if (o.violin_id && !v) throw new Error(`${d.slice}: violin_id ${o.violin_id} is not in the violin catalogue`);
    const composer = v?.composer ?? o.composer;
    const title = v?.title ?? o.title;
    if (v && v.title !== o.title) report.crossTitleFixed.push(`${o.violin_id}: "${o.title}" -> "${v.title}"`);
    const k = key(composer, title);
    if (seen.has(k)) {
      report.duplicates.push(`${d.slice}: ${k}`);
      continue;
    }
    seen.add(k);
    const id = (registry[k] ??= nextId++);
    const w: ChamberWork = {
      id,
      composer,
      title,
      ...(o.aka?.length ? { aka: o.aka } : {}),
      formation: o.formation,
      ...(o.formationNote ? { formationNote: o.formationNote } : {}),
      instruments: o.instruments,
      ...(o.alternatives && Object.keys(o.alternatives).length ? { alternatives: o.alternatives } : {}),
      ...(o.optional && Object.keys(o.optional).length ? { optional: o.optional } : {}),
      players: o.players,
      form: o.form,
      level: v?.level ?? o.level_guess,
      hardestPart: o.hardest_part_guess,
      year: o.year,
      minutes: v ? v.minutes : o.minutes,
      set: v ? v.set : o.set,
      notes: v ? v.notes : o.notes,
      popularity: v ? v.popularity : o.popularity,
      ...(v?.mode ? { mode: v.mode } : {}),
      ...(v?.pace ? { pace: v.pace } : {}),
      ...(v?.character?.length ? { character: v.character } : {}),
      ...((v?.imslpPage ?? o.imslpPage) ? { imslpPage: (v?.imslpPage ?? o.imslpPage)! } : {}),
      ...(v ? { violinId: v.id } : {}),
    };
    if (v) report.crossListed++;
    added.push(w);
    sources[id] = { slice: d.slice, levelGuess: o.level_guess, confidence: o.confidence, sources: o.sources, floor: o.floor ?? {}, levelBasis: o.level_basis ?? "", gap: !!o.gap };
  }
}

const works = [...benchmarks, ...added];
console.log(
  `${works.length} works: ${benchmarks.length} benchmarks + ${added.length} added (${report.crossListed} also in the violin catalogue) from ${report.slices} slices; ` +
    `${report.benchmarksSkipped} benchmark lines skipped; ${report.newComposers} new composers`,
);
for (const [label, xs] of [["cross-listed titles taken from the violin row", report.crossTitleFixed], ["duplicates dropped", report.duplicates], ["composer metadata conflicts", report.composerConflicts]] as const)
  if (xs.length) console.log(`\n${label} (${xs.length}):\n  ${xs.slice(0, 40).join("\n  ")}${xs.length > 40 ? "\n  …" : ""}`);
if (!dry) {
  write("data/chamber/works.json", works);
  write("data/chamber/composers.json", Object.fromEntries(Object.entries(composers).sort(([a], [b]) => a.localeCompare(b))));
  write("data/chamber/id-registry.json", registry);
  write("data/chamber/sources.json", sources);
}
