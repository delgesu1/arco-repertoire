/**
 * Duos in the chamber section (docs/chamber-music-plan.md, "Duos"): violin-catalogue works for two players that are chamber
 * music by convention, listed in both sections as one entry. The violin section keeps the violin part's level; the chamber
 * section shows the level of the hardest part, so the partner's part is graded blind by two graders (a third where they differ).
 *
 *   npx tsx scripts/chamber/duos.ts prep        # candidates → data/chamber/duos/to-grade/dNN.json (+ anchors.json)
 *   npx tsx scripts/chamber/duos.ts third       # the items graders A and B disagree on → to-grade/cNN.json
 *   npx tsx scripts/chamber/duos.ts apply       # combine the grades → new entries in data/chamber/works.json (+ result.json)
 *
 * Candidates (each still has to pass the grader's partnership and floor test):
 *   strings  violin with viola or cello
 *   sonata   sonatas for violin and one keyboard (piano, or the obbligato harpsichord of Bach's BWV 1014–1019)
 *   piano    other violin-and-piano works whose title or length suggests a duo (Schubert's Fantasy, Mozart's variations)
 *   plucked  violin with guitar or harp
 *   violins  two violins alone
 *   trio     two violins and piano (in the section's 3–9 scope, but missed by the IMSLP census)
 * Works already in the chamber section, études, technique and works with orchestra are left out.
 * Graders write data/chamber/duos/grades/<a|b|c><nn>.json (brief: data/chamber/duos/BRIEF.md).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberWork, FormKey, InstrumentKey } from "../../lib/chamber/types";
import { formationFor, instrumentList, partNames, playersFor } from "../../lib/chamber/vocab";
import type { Catalogue, Piece } from "../../lib/types";

const ROOT = join(__dirname, "..", "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const write = (p: string, v: unknown) => writeFileSync(join(ROOT, p), JSON.stringify(v, null, 1) + "\n");
const DIR = "data/chamber/duos";
const CHUNK = 60; // d01 was graded in 60s; the rest were regrouped into six chunks of 112 to save usage

type Scoring = { instruments: Record<string, number>; alternatives?: Record<string, string[]>; optional?: Record<string, number> };
const violin = read<Catalogue>("data/build/catalogue.json").pieces;
const works = read<ChamberWork[]>("data/chamber/works.json");
const scoringMap = read<Record<string, Scoring>>("data/instrumentation-map.json");
const listed = new Set(works.filter((w) => w.violinId != null).map((w) => w.violinId));

type Group = "strings" | "sonata" | "piano" | "plucked" | "violins" | "trio";
const KEYBOARD = new Set(["piano", "harpsichord", "organ"]);
const ENSEMBLES = new Set(["orchestra", "string-orchestra", "ensemble"]);
const DUO_TITLE =
  /\b(duo|duet|fantas|phantas|sonatin|variation|rondo|suite|partita|divertiment|nocturne|po[eè]me|poem|ballade|rhapsod|elegy|élégie|romance)/i;
function groupOf(p: Piece): Group | null {
  if (listed.has(p.id) || p.type === "etude" || p.type === "technique") return null;
  const s = scoringMap[p.accompaniment]?.instruments;
  // a piano part that stands for an orchestra ("Piano or orchestra") is an accompaniment, not a duo partner
  if (!s || Object.values(scoringMap[p.accompaniment].alternatives ?? {}).flat().some((k) => ENSEMBLES.has(k))) return null;
  const keys = Object.keys(s);
  const only = (...ks: string[]) => keys.length === ks.length && ks.every((k) => k in s);
  if (s.violin === 1 && (only("violin", "cello") || only("violin", "viola"))) return "strings";
  if (s.violin === 1 && keys.length === 2 && keys.some((k) => KEYBOARD.has(k)))
    return p.type === "sonata" ? "sonata" : DUO_TITLE.test(p.title) && (p.minutes ?? 0) >= 8 ? "piano" : null;
  if (s.violin === 1 && (only("violin", "guitar") || only("violin", "harp"))) return "plucked";
  if (only("violin") && s.violin === 2) return "violins";
  if (only("violin", "piano") && s.violin === 2) return "trio";
  return null;
}
/** the part(s) the violin catalogue's level already describes: the solo violin, or the first of several */
const violinPart = (ins: Record<string, number>) => (ins.violin > 1 ? "violin 1" : "violin");

const cmd = process.argv[2];
mkdirSync(join(ROOT, DIR, "to-grade"), { recursive: true });
mkdirSync(join(ROOT, DIR, "grades"), { recursive: true });

if (cmd === "prep") {
  const items = violin
    .map((p) => ({ p, g: groupOf(p) }))
    .filter((x): x is { p: Piece; g: Group } => x.g != null)
    .sort((a, b) => a.p.composer.localeCompare(b.p.composer) || a.p.id - b.p.id)
    .map(({ p, g }) => {
      const sc = scoringMap[p.accompaniment];
      const ins = sc.instruments;
      const given = violinPart(ins);
      return {
        key: String(p.id),
        group: g,
        composer: p.composer,
        title: p.title,
        scoring: instrumentList(ins as Partial<Record<InstrumentKey, number>>, { alternatives: sc.alternatives, optional: sc.optional } as never),
        violinLevel: p.level,
        violinPart: given,
        grade: partNames(ins as Partial<Record<InstrumentKey, number>>).filter((k) => k !== given),
        catalogueType: p.type,
        minutes: p.minutes ?? 0,
        popularity: p.popularity ?? "",
        set: p.set,
        notes: p.notes,
      };
    });
  for (let i = 0; i * CHUNK < items.length; i++)
    write(`${DIR}/to-grade/d${String(i + 1).padStart(2, "0")}.json`, { chunk: `d${String(i + 1).padStart(2, "0")}`, items: items.slice(i * CHUNK, (i + 1) * CHUNK) });
  const by = (g: Group) => items.filter((x) => x.group === g).length;
  console.log(
    `${items.length} candidates in ${Math.ceil(items.length / CHUNK)} chunks: ` +
      (["strings", "sonata", "piano", "plucked", "violins", "trio"] as Group[]).map((g) => `${g} ${by(g)}`).join(", "),
  );
  process.exit(0);
}

interface Grade {
  key: string;
  include: boolean;
  why?: string;
  form?: FormKey;
  parts?: Record<string, number>;
  ensemble?: 0 | 1;
  confidence?: "high" | "medium" | "low";
}
const gradesOf = (prefix: string): Map<string, Grade> => {
  const m = new Map<string, Grade>();
  for (const f of readdirSync(join(ROOT, DIR, "grades")).filter((f) => f.startsWith(prefix) && f.endsWith(".json")))
    for (const g of read<{ grades: Grade[] }>(`${DIR}/grades/${f}`).grades) m.set(g.key, g);
  return m;
};
type Item = { key: string; grade: string[]; violinLevel: number; violinPart: string; [k: string]: unknown };
const allItems = (): Item[] =>
  readdirSync(join(ROOT, DIR, "to-grade"))
    .filter((f) => f.startsWith("d"))
    .sort()
    .flatMap((f) => read<{ items: Item[] }>(`${DIR}/to-grade/${f}`).items);
/** the chamber level and hardest part one grader's answer gives */
const outcome = (g: Grade, it: Item) => {
  const lv: Record<string, number> = { [String(it.violinPart)]: it.violinLevel, ...g.parts };
  const top = Math.max(...Object.values(lv));
  const tops = Object.keys(lv).filter((k) => lv[k] === top);
  return `${Math.min(10, top + (g.ensemble ?? 0))}|${tops.length > 1 ? "balanced" : tops[0]}`;
};
/**
 * A and B disagree in a way that matters: on inclusion, or on the chamber level or hardest part their answers give. Other
 * differences (a part below the violin's a level apart, the form) are settled without a third grader: the higher level, A's form.
 */
const differ = (a: Grade, b: Grade, it: Item) => a.include !== b.include || (a.include && outcome(a, it) !== outcome(b, it));

if (cmd === "third") {
  const A = gradesOf("a"), B = gradesOf("b");
  const items = allItems().filter((it) => A.has(it.key) && B.has(it.key) && differ(A.get(it.key)!, B.get(it.key)!, it));
  for (let i = 0; i * CHUNK < items.length; i++)
    write(`${DIR}/to-grade/c${String(i + 1).padStart(2, "0")}.json`, { chunk: `c${String(i + 1).padStart(2, "0")}`, items: items.slice(i * CHUNK, (i + 1) * CHUNK) });
  console.log(`${items.length} items for a third grader in ${Math.ceil(items.length / CHUNK)} chunks`);
  process.exit(0);
}

if (cmd === "apply") {
  const A = gradesOf("a"), B = gradesOf("b"), C = gradesOf("c");
  const median = (xs: number[]) => [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)];
  const majority = <T>(xs: T[]) => {
    const n = new Map<T, number>();
    xs.forEach((x) => n.set(x, (n.get(x) ?? 0) + 1));
    return [...n].sort((x, y) => y[1] - x[1])[0][0];
  };
  const details = existsSync(join(ROOT, "data/details/works.json")) ? read<Record<string, { composed?: string }>>("data/details/works.json") : {};
  const registry = read<Record<string, number>>("data/chamber/id-registry.json");
  let nextId = Math.max(...Object.values(registry), ...works.map((w) => w.id)) + 1;
  const byId = new Map(violin.map((p) => [String(p.id), p]));
  const added: ChamberWork[] = [];
  const result: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const it of allItems()) {
    const a = A.get(it.key), b = B.get(it.key), c = C.get(it.key);
    if (!a || !b || (differ(a, b, it) && !c)) {
      missing.push(it.key);
      continue;
    }
    const gs = c ? [a, b, c] : [a, b];
    const include = majority(gs.map((g) => g.include));
    const yes = gs.filter((g) => g.include);
    if (!include) {
      result[it.key] = { include: false, why: gs.find((g) => !g.include)?.why ?? "" };
      continue;
    }
    const p = byId.get(it.key)!;
    const sc = scoringMap[p.accompaniment];
    const ins = sc.instruments as Partial<Record<InstrumentKey, number>>;
    const partLevels: Record<string, number> = { [violinPart(ins)]: p.level };
    // the median of three, or of two the higher
    for (const k of it.grade) partLevels[k] = median(yes.map((g) => g.parts?.[k]).filter((x): x is number => x != null));
    const top = Math.max(...Object.values(partLevels));
    const hardest = Object.keys(partLevels).filter((k) => partLevels[k] === top);
    const ensemble = majority(yes.map((g) => g.ensemble ?? 0));
    const form = majority(yes.map((g) => g.form ?? "work")); // with two graders who differ: A's
    const confidence = majority(yes.map((g) => g.confidence ?? "medium"));
    const regKey = `${p.composer}|${p.title}`;
    const id = registry[regKey] ?? nextId++;
    registry[regKey] = id;
    const players = playersFor(ins);
    added.push({
      id,
      composer: p.composer,
      title: p.title,
      formation: formationFor(ins),
      instruments: ins,
      ...(sc.alternatives ? { alternatives: sc.alternatives as ChamberWork["alternatives"] } : {}),
      ...(sc.optional ? { optional: sc.optional as ChamberWork["optional"] } : {}),
      players,
      form,
      level: Math.min(10, top + ensemble),
      hardestPart: hardest.length > 1 ? "balanced" : hardest[0],
      partLevels,
      year: details[it.key]?.composed ?? "",
      minutes: p.minutes ? Math.round(p.minutes) : null,
      set: p.set,
      notes: "", // the build shows the violin entry's notes
      popularity: p.popularity,
      mode: p.mode,
      pace: p.pace,
      character: p.character,
      violinId: p.id, // the build takes the IMSLP page and the recording from the violin entry
    });
    result[it.key] = { include: true, partLevels, ensemble, form, confidence, graders: gs.length };
  }
  if (missing.length) {
    console.error(`${missing.length} items lack grades (run the graders, then \`third\`, first): ${missing.slice(0, 10).join(", ")}…`);
    process.exit(1);
  }
  // re-running replaces the duo entries this script made before, and leaves every other work as it was
  const mine = new Set(added.map((w) => w.violinId));
  const kept = works.filter((w) => w.violinId == null || !mine.has(w.violinId));
  write("data/chamber/works.json", [...kept, ...added]);
  write("data/chamber/id-registry.json", registry);
  write(`${DIR}/result.json`, result);
  const raised = added.filter((w) => w.level > byId.get(String(w.violinId))!.level).length;
  console.log(`${added.length} duos added (${raised} with a chamber level above the violin level), ${Object.keys(result).length - added.length} left out`);
  process.exit(0);
}

throw new Error("usage: duos.ts prep | third | apply");
