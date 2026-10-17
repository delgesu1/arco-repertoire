/**
 * Checks the curation agents' output (data/chamber/curation/out/<slice>.json) against the brief
 * (data/chamber/curation/AGENT_BRIEF.md), the schema of lib/chamber/types.ts, the benchmarks and the slice's input.
 *
 *   npx tsx scripts/chamber/curation_check.ts [slice …] [--json]
 *
 * Errors break a rule that the merge into works.json will need (scope, players, formation, benchmark and violin
 * agreement, coverage of the input); warnings are house-style hints for the reviewer. Exits 1 on any error.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { InstrumentKey } from "../../lib/chamber/types";
import { FORMATIONS, FORMS, INSTRUMENTS, formationFor, playersFor } from "../../lib/chamber/vocab";
import type { Catalogue } from "../../lib/types";

const ROOT = join(__dirname, "..", "..");
const DIR = join(ROOT, "data/chamber/curation");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

interface OutWork {
  composer: string;
  title: string;
  aka?: string[];
  instruments: Record<string, number>;
  alternatives?: Record<string, string[]>;
  optional?: Record<string, number>;
  players: number;
  formation: string;
  formationNote?: string | null;
  form: string;
  set: string | null;
  year: string;
  minutes: number | null;
  notes: string;
  popularity: string;
  level_guess: number;
  level_basis?: string;
  hardest_part_guess: string;
  imslpPage: string | null;
  benchmark_id?: number | null;
  violin_id?: number | null;
  floor?: Record<string, string>;
  sources: string[];
  confidence: string;
  gap?: boolean; // found by the gap check (the score may still be on IMSLP under another page)
}
interface Out {
  slice: string;
  authors?: { name: string }[];
  works: OutWork[];
  skipped: { composer?: string; title?: string; imslpPage?: string | null; works?: number; reason: string }[];
  benchmark_issues?: unknown[];
  exclude_composers?: { name: string; reason: string }[];
  composers_checked?: { name: string; coverage?: string }[];
  note?: string;
}

const benchmarks = new Map((read("data/chamber/works.json") as { id: number; composer: string; title: string; level: number }[]).map((w) => [w.id, w]));
const violin = (read("data/build/catalogue.json") as Catalogue).pieces;
const violinById = new Map(violin.map((p) => [p.id, p]));
const known = new Set([...violin.map((p) => p.composer), ...Object.keys(read("data/chamber/composers.json"))]);
const excluded = read("data/chamber/excluded-composers.json") as Record<string, string>;
const formations = new Set(FORMATIONS.map((f) => f.key as string));
const forms = new Set(FORMS.map((f) => f.key as string));
const isKey = (k: string): k is InstrumentKey => k in INSTRUMENTS;

// house style: "Op. 18 No. 4", "K. 525", "Hob. III:77", "B-flat major", nickname ("…") last
const STYLE: [RegExp, string][] = [
  [/\b(Op|No|K|D|Hob|BWV|HWV|RV|TWV|WoO|Sz|B|G|L|M|P|H)\.(?=\d|[IVX])/, 'catalogue abbreviation without a space ("Op.18" → "Op. 18")'],
  [/\b[A-G] (flat|sharp)\b/, 'key without a hyphen ("B flat" → "B-flat")'],
  [/\b[A-G](-flat|-sharp)? (Major|Minor)\b/, 'key with a capital ("D Major" → "D major")'],
  [/'[^']+'\s*$/, "nickname in single quotes (house style is (\"…\") at the end)"],
  [/\(Haydn|\(Mozart|\(Op\.|\(Hob/, "IMSLP-style parenthesis left in the title"],
];

function check(slice: string) {
  const out: Out = JSON.parse(readFileSync(join(DIR, "out", `${slice}.json`), "utf8"));
  const inputPath = join(DIR, "input", `${slice}.json`);
  const input = existsSync(inputPath) ? JSON.parse(readFileSync(inputPath, "utf8")) : null;
  const errors: string[] = [];
  const warnings: string[] = [];
  const authors = new Set((out.authors ?? []).map((a) => a.name));
  const seen = new Set<string>();

  for (const w of out.works ?? []) {
    const id = `${w.composer} | ${w.title}`;
    const e = (m: string) => errors.push(`${id}: ${m}`);
    const warn = (m: string) => warnings.push(`${id}: ${m}`);
    if (seen.has(id)) e("listed twice");
    seen.add(id);
    if (!/^([^,]+, .+|\p{Lu}\p{Ll}+ \p{Lu}[\p{Ll}-]+|\p{Lu}[\p{Ll}-]+)$/u.test(w.composer)) e(`composer "${w.composer}" is not "Surname, Given names" (or one name)`);
    if (!known.has(w.composer) && !authors.has(w.composer)) e(`composer "${w.composer}" is in neither the violin catalogue, composers.json nor authors`);
    if (excluded[w.composer]) e("composer is excluded");

    const ins = w.instruments ?? {};
    const bad = Object.keys(ins).filter((k) => !isKey(k));
    if (bad.length) e(`unknown instruments ${bad.join(", ")}`);
    else {
      const players = playersFor(ins as Record<InstrumentKey, number>);
      if (w.players !== players) e(`players ${w.players}, instruments make ${players}`);
      if (players < 3 || players > 9) e(`${players} players`);
      if (!Object.keys(ins).some((k) => INSTRUMENTS[k as InstrumentKey].family === "string")) e("no string part");
      if (Object.keys(ins).every((k) => k === "violin")) e("violins alone");
      const derived = formationFor(ins as Record<InstrumentKey, number>);
      if (!formations.has(w.formation)) e(`unknown formation "${w.formation}"`);
      else if (w.formation !== derived && !w.formationNote) e(`formation "${w.formation}", instruments say "${derived}"`);
      else if (w.formation === derived && w.formationNote) e("formationNote set, but the formation is the derived one (check.ts rejects this)");
      for (const [k, alts] of Object.entries(w.alternatives ?? {})) {
        if (!ins[k]) e(`alternatives.${k}: no such part`);
        for (const a of alts) if (!isKey(a)) e(`alternatives.${k}: unknown instrument ${a}`);
      }
      for (const k of Object.keys(w.optional ?? {})) {
        if (!isKey(k)) e(`optional: unknown instrument ${k}`);
        if (ins[k]) e(`optional.${k} is also in instruments`);
      }
      const h = w.hardest_part_guess;
      if (h !== "balanced") {
        const m = h?.match(/^([a-z-]+?)(?: (\d))?$/);
        const n = m ? ins[m[1]] : undefined;
        if (!m || !n) e(`hardest part "${h}" is not one of the instruments`);
        else if (n > 1 && !m[2]) e(`hardest part "${h}" needs a number`);
        else if (n === 1 && m[2]) e(`hardest part "${h}" has a number but there is one`);
      }
    }
    if (!forms.has(w.form)) e(`unknown form "${w.form}"`);
    if (!Number.isInteger(w.level_guess) || w.level_guess < 1 || w.level_guess > 10) e(`level_guess ${w.level_guess}`);
    if (typeof w.year !== "string") e("year is not a string");
    if (w.minutes !== null && (!Number.isInteger(w.minutes) || w.minutes <= 0)) e(`minutes ${w.minutes}`);
    if ((w.notes ?? "").length > 120) e(`notes are ${w.notes.length} characters (max 120)`);
    if (!["well-known", "lesser-known"].includes(w.popularity)) e(`popularity "${w.popularity}"`);
    if (!["high", "medium", "low"].includes(w.confidence)) warn(`confidence "${w.confidence}"`);
    if (!w.sources?.length) e("no sources");

    if (w.benchmark_id != null) {
      const b = benchmarks.get(w.benchmark_id);
      if (!b) e(`benchmark_id ${w.benchmark_id} does not exist`);
      else {
        if (b.composer !== w.composer || b.title !== w.title) e(`benchmark ${b.id} is "${b.composer} | ${b.title}"`);
        if (b.level !== w.level_guess) e(`benchmark ${b.id} has level ${b.level}, level_guess ${w.level_guess}`);
      }
    }
    if (w.violin_id != null) {
      const v = violinById.get(w.violin_id);
      if (!v) e(`violin_id ${w.violin_id} does not exist`);
      else {
        if (v.title !== w.title) e(`violin ${v.id} is titled "${v.title}"`);
        if (v.level !== w.level_guess) e(`violin ${v.id} has level ${v.level}, level_guess ${w.level_guess}`);
      }
    }
    if (w.violin_id == null) for (const [re, m] of STYLE) if (re.test(w.title)) warn(m);
  }

  // every benchmark in the input is reported, and every candidate page is kept or skipped
  const coverage: string[] = [];
  if (input) {
    const kept = new Set(out.works.map((w) => w.imslpPage).filter(Boolean));
    const skipped = new Set(out.skipped.map((s) => s.imslpPage).filter(Boolean));
    for (const c of input.candidates as { title: string }[]) if (!kept.has(c.title) && !skipped.has(c.title)) coverage.push(c.title);
    if (coverage.length) errors.push(`${coverage.length} candidate page(s) neither kept nor skipped: ${coverage.slice(0, 5).join(" · ")}${coverage.length > 5 ? " …" : ""}`);
    const reported = new Set(out.works.map((w) => w.benchmark_id).filter((x) => x != null));
    for (const b of input.benchmarks as { id: number; title: string }[]) if (!reported.has(b.id)) errors.push(`benchmark ${b.id} ${b.title} is not reported`);
  }

  const reasons: Record<string, number> = {};
  for (const s of out.skipped ?? []) {
    const r = s.reason.replace(/:.*$/, "").replace(/ of .*$/, "");
    reasons[r] = (reasons[r] ?? 0) + (s.works ?? 1);
  }
  return {
    slice,
    kept: out.works.length,
    benchmarks: out.works.filter((w) => w.benchmark_id != null).length,
    addedNotOnImslp: out.works.filter((w) => !w.imslpPage || w.gap).length,
    skippedPages: out.skipped.length,
    skippedWorks: out.skipped.reduce((n, s) => n + (s.works ?? 1), 0),
    skippedByReason: Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1] - a[1])),
    excludeProposals: out.exclude_composers ?? [],
    benchmarkIssues: out.benchmark_issues?.length ?? 0,
    levels: Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, out.works.filter((w) => w.level_guess === i + 1).length])),
    errors,
    warnings,
  };
}

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const slices = args.length ? args : readdirSync(join(DIR, "out")).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
const reports = slices.map(check);
if (process.argv.includes("--json")) console.log(JSON.stringify(reports, null, 1));
else
  for (const r of reports) {
    console.log(
      `\n${r.slice}: ${r.kept} kept (${r.benchmarks} benchmarks, ${r.addedNotOnImslp} not on IMSLP), ${r.skippedPages} pages skipped (${r.skippedWorks} works), ` +
        `${r.errors.length} errors, ${r.warnings.length} warnings`,
    );
    console.log(`  skipped: ${Object.entries(r.skippedByReason).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
    console.log(`  levels: ${Object.entries(r.levels).map(([k, v]) => `${k}:${v}`).join(" ")}`);
    for (const e of r.errors.slice(0, 30)) console.log(`  ERROR ${e}`);
    for (const w of r.warnings.slice(0, 15)) console.log(`  warn  ${w}`);
  }
if (reports.some((r) => r.errors.length)) process.exit(1);
