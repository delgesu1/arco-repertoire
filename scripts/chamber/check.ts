/**
 * Checks the chamber section's data (docs/chamber-music-plan.md) against its schema and against the violin catalogue.
 *
 *   data/chamber/works.json       the works (source of truth)
 *   data/chamber/composers.json   metadata for composers who have no violin entries
 *   data/build/catalogue.json     the violin catalogue (composer metadata, cross-listed works)
 *
 * Prints a level × formation table; exits 1 on any error.
 *   npx tsx scripts/chamber/check.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { ChamberComposer, ChamberWork, FormationKey, InstrumentKey } from "../../lib/chamber/types";
import { FORMATIONS, FORMS, INSTRUMENTS, formationFor, partNames, playersFor } from "../../lib/chamber/vocab";
import type { Catalogue } from "../../lib/types";
import { CHARACTER, ERAS } from "../../lib/vocab";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const keys = <T extends string>(xs: readonly { key: T }[]) => xs.map((x) => x.key) as [T, ...T[]];
const instrumentKeys = Object.keys(INSTRUMENTS) as [InstrumentKey, ...InstrumentKey[]];

const Work = z
  .object({
    id: z.number().int().min(100001),
    // "Surname, Given names", or a name written family name first without a comma, as the violin catalogue writes
    // Chinese names ("Tan Dun", "Chen Yi"); either way it must be in the violin catalogue or composers.json (below)
    composer: z
      .string()
      .regex(/^([^,]+, .+|\p{Lu}\p{Ll}+ \p{Lu}[\p{Ll}-]+|\p{Lu}[\p{Ll}-]+)$/u, 'composer must be "Surname, Given names" (or family name first: "Tan Dun", or one name: "Carolo")'),
    title: z.string().min(1),
    aka: z.array(z.string().min(1)).optional(),
    formation: z.enum(keys(FORMATIONS)),
    formationNote: z.string().min(1).optional(),
    instruments: z.record(z.enum(instrumentKeys), z.number().int().positive()),
    alternatives: z.record(z.enum(instrumentKeys), z.array(z.enum(instrumentKeys)).min(1)).optional(),
    optional: z.record(z.enum(instrumentKeys), z.number().int().positive()).optional(),
    players: z.number().int(),
    form: z.enum(keys(FORMS)),
    level: z.number().int().min(1).max(10),
    hardestPart: z.string().min(1),
    partLevels: z.record(z.string(), z.number().int().min(1).max(10)).optional(),
    era: z.enum(keys(ERAS)).optional(),
    year: z.string(),
    minutes: z.number().int().positive().nullable(),
    set: z.string().min(1).nullable(),
    notes: z.string().max(120),
    popularity: z.enum(["well-known", "lesser-known"]).nullable(),
    mode: z.enum(["major", "minor"]).nullable().optional(),
    pace: z.enum(["slow", "moderate", "lively"]).nullable().optional(),
    character: z.array(z.enum(CHARACTER)).optional(),
    imslpPage: z.string().min(1).optional(),
    violinId: z.number().int().positive().optional(),
    benchmark: z.enum(["proposed", "approved"]).optional(),
    basis: z.string().min(1).optional(),
  })
  .strict();

const Composer = z
  .object({
    dates: z.string(),
    nationality: z.string(),
    gender: z.enum(["F", "M", ""]),
    era: z.enum(keys(ERAS)),
  })
  .strict();

const errors: string[] = [];
const err = (w: { id?: number; title?: string } | null, m: string) => errors.push(w ? `${w.id} ${w.title}: ${m}` : m);

const rawWorks: unknown[] = read("data/chamber/works.json");
const rawComposers: Record<string, unknown> = read("data/chamber/composers.json");
const violin = (read("data/build/catalogue.json") as Catalogue).pieces;
const violinById = new Map(violin.map((p) => [p.id, p]));
const violinComposers = new Set(violin.map((p) => p.composer));

const composers = new Map<string, ChamberComposer>();
for (const [name, c] of Object.entries(rawComposers)) {
  const r = Composer.safeParse(c);
  if (!r.success) err(null, `composers.json "${name}": ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
  else composers.set(name, r.data);
  // one source per composer: violin composers take their metadata from the violin rows
  if (violinComposers.has(name)) err(null, `composers.json "${name}" is in the violin catalogue; take its metadata from there`);
}

const works: ChamberWork[] = [];
for (const raw of rawWorks) {
  const r = Work.safeParse(raw);
  const w = raw as ChamberWork;
  if (!r.success) err(w, r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; "));
  else works.push(r.data as ChamberWork);
}

const seenIds = new Set<number>();
const seenTitles = new Set<string>();
for (const w of works) {
  if (seenIds.has(w.id)) err(w, "duplicate id");
  seenIds.add(w.id);
  const t = `${w.composer}|${w.title}`;
  if (seenTitles.has(t)) err(w, "duplicate title for this composer");
  seenTitles.add(t);

  if (!violinComposers.has(w.composer) && !composers.has(w.composer))
    err(w, `composer "${w.composer}" is neither in the violin catalogue nor in data/chamber/composers.json`);

  // scope: 3–9 parts, or a duo the violin section lists too (scripts/chamber/duos.ts); at least one string instrument; not
  // violins alone (unless with continuo), except a duo for two violins
  const ins = w.instruments;
  const players = playersFor(ins);
  if (w.players !== players) err(w, `players is ${w.players} but the instruments make ${players}`);
  if (players < 2 || players > 9) err(w, `${players} players is outside the section's scope (2–9)`);
  if (players === 2 && w.violinId == null) err(w, "a duo must be listed in the violin section too (violinId)");
  const strings = (Object.keys(ins) as InstrumentKey[]).filter((k) => INSTRUMENTS[k].family === "string");
  if (!strings.length) err(w, "no string instrument: out of scope");
  if (Object.keys(ins).every((k) => k === "violin") && players > 2) err(w, "violins alone belong to the violin section");

  // alternatives replace a part of the scoring; ad lib. parts sit outside it
  for (const [k, alts] of Object.entries(w.alternatives ?? {}) as [InstrumentKey, InstrumentKey[]][]) {
    if (!ins[k]) err(w, `alternatives.${k}: there is no ${k} part to replace`);
    if (alts.includes(k)) err(w, `alternatives.${k} lists the instrument itself`);
  }
  for (const k of Object.keys(w.optional ?? {}) as InstrumentKey[])
    if (ins[k]) err(w, `optional.${k}: an ad lib. part must not also be in instruments`);

  const derived: FormationKey = formationFor(ins);
  if (w.formation !== derived && !w.formationNote) err(w, `formation "${w.formation}" but the instruments say "${derived}" (add a formationNote if intended)`);
  if (w.formation === derived && w.formationNote) err(w, "formationNote is set but the formation needs no explanation");

  // hardest part: "balanced", an instrument, or a numbered part ("violin 1") when there are several
  if (w.hardestPart !== "balanced") {
    const m = w.hardestPart.match(/^([a-z-]+?)(?: (\d))?$/);
    const k = m?.[1] as InstrumentKey | undefined;
    const n = ins[k as InstrumentKey];
    if (!m || !k || !n) err(w, `hardestPart "${w.hardestPart}" is not one of the instruments`);
    else if (n > 1 && !m[2]) err(w, `hardestPart "${w.hardestPart}" needs a number (there are ${n})`);
    else if (n === 1 && m[2]) err(w, `hardestPart "${w.hardestPart}" has a number but there is only one`);
    else if (m[2] && Number(m[2]) > n) err(w, `hardestPart "${w.hardestPart}": there are only ${n}`);
  }

  if (w.benchmark && !w.basis) err(w, "benchmark without a basis");
  if (!w.benchmark && w.basis) err(w, "basis is only for benchmarks");

  // part levels: every part graded, the level the highest of them (raised by up to one), the hardest part the highest one
  if (w.partLevels) {
    const names = partNames(ins);
    for (const [k, lv] of Object.entries(w.partLevels)) {
      if (!names.includes(k)) err(w, `partLevels.${k} is not one of the parts (${names.join(", ")})`);
      if (!Number.isInteger(lv) || lv < 1 || lv > 10) err(w, `partLevels.${k} ${lv} is not 1–10`);
    }
    for (const k of names) if (w.partLevels[k] == null) err(w, `partLevels has no level for the ${k} part`);
    const top = Math.max(...Object.values(w.partLevels));
    const tops = Object.keys(w.partLevels).filter((k) => w.partLevels![k] === top);
    if (w.level < top || w.level > Math.min(10, top + 1)) err(w, `level ${w.level} but the hardest part is ${top} (the level is that, or one more)`);
    if (w.hardestPart !== (tops.length > 1 ? "balanced" : tops[0])) err(w, `hardestPart "${w.hardestPart}" but partLevels say "${tops.length > 1 ? "balanced" : tops[0]}"`);
  }

  // a work in both sections agrees with the violin catalogue: the same composer and title, and the violin part's level
  // (the work's level when its parts are not graded separately)
  if (w.violinId != null) {
    const v = violinById.get(w.violinId);
    if (!v) err(w, `violinId ${w.violinId} is not in the violin catalogue`);
    else {
      for (const f of ["composer", "title"] as const) if (v[f] !== w[f]) err(w, `${f} differs from violin ${v.id} ("${v[f]}")`);
      const violinPart = w.partLevels ? (w.partLevels.violin ?? w.partLevels["violin 1"]) : w.level;
      if (violinPart !== v.level) err(w, `the violin part's level ${violinPart} differs from violin ${v.id} (${v.level})`);
    }
  }
}

// level × formation table
const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(`${"".padEnd(24)}${Array.from({ length: 10 }, (_, i) => pad(i + 1, 5)).join("")}   all`);
for (const f of FORMATIONS) {
  const ws = works.filter((w) => w.formation === f.key);
  if (!ws.length) continue;
  const row = Array.from({ length: 10 }, (_, i) => ws.filter((w) => w.level === i + 1).length);
  console.log(`${f.label.padEnd(24)}${row.map((n) => pad(n || "·", 5)).join("")}${pad(ws.length, 6)}`);
}
const all = Array.from({ length: 10 }, (_, i) => works.filter((w) => w.level === i + 1).length);
console.log(`${"All".padEnd(24)}${all.map((n) => pad(n || "·", 5)).join("")}${pad(works.length, 6)}`);
const bench = works.filter((w) => w.benchmark);
console.log(
  `\n${works.length} works (${bench.length} benchmarks: ${bench.filter((w) => w.benchmark === "approved").length} approved), ` +
    `${works.filter((w) => w.violinId).length} cross-listed, ${new Set(works.map((w) => w.composer)).size} composers`,
);

if (errors.length) {
  console.error(`\n${errors.length} error(s):\n${errors.map((e) => `  ${e}`).join("\n")}`);
  process.exit(1);
}
