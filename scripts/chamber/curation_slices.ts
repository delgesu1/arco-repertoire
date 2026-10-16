/**
 * Phase 2 curation plan (docs/chamber-music-plan.md): cut the census candidates into composer slices for research
 * subagents (brief: data/chamber/curation/AGENT_BRIEF.md), and on request write each slice's input file.
 *
 * Reads   data/chamber/census/candidates.jsonl, out-of-scope.jsonl, benchmark-matches.json (scripts/chamber/imslp_census.ts)
 *         data/chamber/works.json, data/build/catalogue.json
 * Writes  data/chamber/curation/groups.json            the slices: kind, composers (a big composer split by formation), sizes
 *         data/chamber/curation/modern-coverage.json   for each composer of the hand-written phase-3 plan (groups-modern.json): IMSLP coverage
 *         data/chamber/curation/input/<slice>.json     with --inputs: what one agent gets (candidates, benchmarks, violin entries),
 *                                                      for the phase-2 slices and the phase-3 ones of groups-modern.json (not in git)
 *
 *   npx tsx scripts/chamber/curation_slices.ts [--inputs]
 *
 * Kinds: core (a composer with 5+ works IMSLP links to a commercial recording, a benchmark composer, or one of CORE_EXTRA): full curation and a
 * gap check against a standard work list · mid (1–4 such works): full curation, no gap check · tail (none): triage, one
 * recording check per composer first, then only the works that might pass the floor.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberWork, FormationKey } from "../../lib/chamber/types";
import type { Catalogue } from "../../lib/types";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const jsonl = <T>(p: string): T[] => readFileSync(join(ROOT, p), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T);

interface Cand {
  composer: string;
  title: string;
  formation: FormationKey;
  works: number;
  era: string;
  signals: string[];
  flags: string[];
  [k: string]: unknown;
}
const candidates = jsonl<Cand>("data/chamber/census/candidates.jsonl");
const outOfScope = jsonl<{ composer: string }>("data/chamber/census/out-of-scope.jsonl");
const matches: { id: number; imslpPage: string | null; how: string }[] = read("data/chamber/census/benchmark-matches.json");
const benchmarks: ChamberWork[] = read("data/chamber/works.json");
const violin = (read("data/build/catalogue.json") as Catalogue).pieces;

const CAPACITY = { core: 130, mid: 250, tail: 600 } as const; // works per slice
const ERA_ORDER = ["early-music", "baroque", "classical", "early-romantic", "late-romantic", "20th-century", "contemporary", "unknown"];
const REGIONS: [RegExp, string][] = [
  [/Italian/, "italy"],
  [/French|Belgian|Dutch|Flemish|Luxemb|Monegasque/, "france-low-countries"],
  [/German|Austrian|Swiss|Bohemian-Austrian/, "german"],
  [/Czech|Bohemian|Slovak|Polish|Hungarian|Croatian|Slovenian|Serbian|Romanian|Bulgarian/, "central-east"],
  [/Russian|Ukrainian|Soviet|Georgian|Armenian|Latvian|Lithuanian|Estonian|Belarus/, "russia-baltic"],
  [/British|English|Scottish|Irish|Welsh/, "britain"],
  [/Norwegian|Swedish|Danish|Finnish|Icelandic/, "nordic"],
  [/Spanish|Portuguese|Catalan/, "iberia"],
  [/American|Canadian|Brazilian|Argentin|Mexican|Cuban|Chilean|Venezuel|Uruguay|Colombian|Peruvian/, "americas"],
];

// ---------- composers ----------
const nationality = new Map<string, string>();
for (const p of violin) if (p.nationality && !nationality.has(p.composer)) nationality.set(p.composer, p.nationality);
const regionOf = (c: string) => {
  const n = nationality.get(c) ?? "";
  return REGIONS.find(([re]) => re.test(n))?.[1] ?? (n ? "other" : "unknown");
};
const benchmarkComposers = new Set(benchmarks.map((w) => w.composer));
interface Stat {
  name: string;
  works: number;
  recorded: number;
  era: string;
  byFormation: Map<FormationKey, number>;
}
const stats = new Map<string, Stat>();
for (const c of candidates) {
  if (!c.works) continue;
  const s =
    stats.get(c.composer) ??
    stats.set(c.composer, { name: c.composer, works: 0, recorded: 0, era: c.era, byFormation: new Map() }).get(c.composer)!;
  s.works += c.works;
  if (c.signals.includes("recorded")) s.recorded += c.works;
  s.byFormation.set(c.formation, (s.byFormation.get(c.formation) ?? 0) + c.works);
}
// era: the composer's most common era
for (const s of stats.values()) {
  const eras = new Map<string, number>();
  for (const c of candidates) if (c.composer === s.name) eras.set(c.era, (eras.get(c.era) ?? 0) + Math.max(1, c.works));
  s.era = [...eras].sort((a, b) => b[1] - a[1])[0][0];
}
// the composers of the hand-written phase-3 plan are curated there entirely, IMSLP candidates included
const modernPlan: { slices: Record<string, string[]> } = read("data/chamber/curation/groups-modern.json");
const phase3 = new Set(Object.values(modernPlan.slices).flat());
const ANON = /^(Anonymous|Various|Traditional)$/;
// standard chamber composers with fewer than five recorded works on IMSLP (its recording links miss many): core all the
// same, so that their slices run the gap check against a work list
const CORE_EXTRA = new Set([
  "Jenkins, John", "Lawes, William", "Locke, Matthew", "Coperario, John", "Dowland, John", // the English viol consort
  "Tartini, Giuseppe", "Leclair, Jean-Marie", "Biber, Heinrich Ignaz Franz", "Schmelzer, Johann Heinrich", "Marini, Biagio", "Castello, Dario",
  "Rossi, Salamone", "Uccellini, Marco", "Rameau, Jean-Philippe", "Rosenmüller, Johann", "Krommer, Franz", "Danzi, Franz", "Viotti, Giovanni Battista",
  "Romberg, Andreas", "Kuhlau, Friedrich", "Arriaga, Juan Crisóstomo de", "Weber, Carl Maria von", "Field, John", "Chopin, Frédéric", "Glinka, Mikhail",
  "Kalliwoda, Johann Wenzel", "Lachner, Franz Paul", "Mayer, Emilie", "Molique, Bernhard", "Fesca, Alexander", "Bruckner, Anton", "Goetz, Hermann",
  "Rheinberger, Josef Gabriel", "Gouvy, Louis Théodore", "Lalo, Édouard", "Widor, Charles-Marie", "Gernsheim, Friedrich", "Fuchs, Robert",
  "Rubinstein, Anton", "Rimsky-Korsakov, Nikolai", "Fibich, Zdeněk", "Novák, Vítězslav", "Martucci, Giuseppe", "Sinding, Christian", "Sibelius, Jean",
  "Elgar, Edward", "Smyth, Ethel", "Strauss, Richard", "Pfitzner, Hans", "Röntgen, Julius", "Lekeu, Guillaume", "Magnard, Albéric", "Pierné, Gabriel",
  "Hahn, Reynaldo", "Bonis, Mel", "Rachmaninoff, Sergei", "Glière, Reinhold", "Bottesini, Giovanni", "Zemlinsky, Alexander von", "Korngold, Erich Wolfgang",
  "Bloch, Ernest", "Ives, Charles", "Vaughan Williams, Ralph", "Ireland, John", "Holst, Gustav", "Delius, Frederick", "Howells, Herbert", "Koechlin, Charles",
]);
for (const c of CORE_EXTRA) if (!stats.has(c)) console.error(`CORE_EXTRA: ${c} has no candidates`);
const kindOf = (s: Stat) =>
  ANON.test(s.name)
    ? "tail"
    : s.recorded >= 5 || benchmarkComposers.has(s.name) || CORE_EXTRA.has(s.name)
      ? "core"
      : s.recorded >= 1
        ? "mid"
        : "tail";

// ---------- slices ----------
type Part = { name: string; formations?: FormationKey[]; label?: string; works: number; recorded: number };
interface Slice {
  slice: string;
  kind: "core" | "mid" | "tail";
  era: string;
  region: string;
  works: number;
  recorded: number;
  composers: Part[];
}
const slug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const surname = (n: string) => slug(n.split(",")[0]);

/** formation families: a composer bigger than a slice is split along them (then by formation, if a family is still too big) */
const FAMILIES: [string, FormationKey[]][] = [
  ["strings", ["string-trio", "string-quartet", "string-quintet", "large-strings"]],
  ["piano", ["piano-trio", "piano-quartet", "piano-quintet", "piano-strings"]],
  ["mixed", ["winds-strings", "continuo", "other"]],
];
function partsOf(s: Stat, cap: number): Part[] {
  if (s.works <= cap) return [{ name: s.name, works: s.works, recorded: s.recorded }];
  const rec = (fs: FormationKey[]) =>
    candidates
      .filter((c) => c.composer === s.name && fs.includes(c.formation) && c.signals.includes("recorded"))
      .reduce((n, c) => n + c.works, 0);
  const size = (fs: FormationKey[]) => fs.reduce((n, f) => n + (s.byFormation.get(f) ?? 0), 0);
  const units: { label: string; formations: FormationKey[] }[] = [];
  for (const [family, fs] of FAMILIES) {
    const present = fs.filter((f) => s.byFormation.get(f));
    if (!present.length) continue;
    if (size(present) <= cap) units.push({ label: family, formations: present });
    else for (const f of present) units.push({ label: f, formations: [f] });
  }
  // pack the units, largest first, into as few parts as fit
  const parts: (Part & { labels: string[] })[] = [];
  for (const u of units.sort((x, y) => size(y.formations) - size(x.formations))) {
    const n = size(u.formations);
    // a small unit joins the smallest part even if that overflows the capacity a little
    const p = parts.find((p) => p.works + n <= cap) ?? (n < cap / 5 ? [...parts].sort((x, y) => x.works - y.works)[0] : undefined);
    if (p) {
      p.formations!.push(...u.formations);
      p.labels.push(u.label);
      p.works += n;
      p.recorded += rec(u.formations);
    } else parts.push({ name: s.name, formations: [...u.formations], labels: [u.label], works: n, recorded: rec(u.formations) });
  }
  return parts.map((p) => ({ ...p, label: p.labels.join("-") }));
}

// pack composers in era order (by region within the era, so that one agent's sources overlap), most recorded first
const slices: Slice[] = [];
for (const kind of ["core", "mid", "tail"] as const) {
  const cap = CAPACITY[kind];
  const group = [...stats.values()].filter((s) => kindOf(s) === kind && s.works > 0 && !phase3.has(s.name));
  const regionKey = (s: Stat) => (kind === "tail" ? "" : regionOf(s.name));
  group.sort(
    (a, b) =>
      ERA_ORDER.indexOf(a.era) - ERA_ORDER.indexOf(b.era) ||
      regionKey(a).localeCompare(regionKey(b)) ||
      (kind === "tail" ? a.name.localeCompare(b.name) : b.recorded - a.recorded || b.works - a.works),
  );
  let cur: Slice | null = null;
  for (const s of group) {
    for (const part of partsOf(s, cap)) {
      if (part.formations) {
        slices.push({ slice: "", kind, era: s.era, region: regionKey(s), works: part.works, recorded: part.recorded, composers: [part] });
        continue; // a split composer's part is a slice of its own
      }
      const fits = cur && cur.era === s.era && cur.works + part.works <= cap;
      if (!fits) {
        cur = { slice: "", kind, era: s.era, region: regionKey(s), works: 0, recorded: 0, composers: [] };
        slices.push(cur);
      }
      cur!.composers.push(part);
      cur!.works += part.works;
      cur!.recorded += part.recorded;
    }
  }
}
// a slice under a quarter of the capacity joins the slice before it (same kind, not a split composer's part)
for (let i = slices.length - 1; i > 0; i--) {
  const [prev, s] = [slices[i - 1], slices[i]];
  const whole = (x: Slice) => !x.composers.some((c) => c.formations);
  if (s.kind === prev.kind && whole(s) && whole(prev) && s.works < CAPACITY[s.kind] / 4) {
    prev.composers.push(...s.composers);
    for (const k of ["works", "recorded"] as const) prev[k] += s[k];
    if (prev.era !== s.era && !prev.era.endsWith(`+${s.era}`)) prev.era = `${prev.era}+${s.era}`;
    slices.splice(i, 1);
  }
}
// within a core or mid slice, the most recorded composers first (the brief: most important first)
for (const s of slices) if (s.kind !== "tail") s.composers.sort((a, b) => b.recorded - a.recorded || b.works - a.works);

// names: c21_haydn-strings, c14_spohr-schubert-mendelssohn, m03_baroque-burney-marini, t07_classical-c-f
const counters = { core: 0, mid: 0, tail: 0 };
for (const s of slices) {
  const n = String(++counters[s.kind]).padStart(2, "0");
  const first = s.composers[0] as Part & { label?: string };
  const label =
    s.kind === "tail"
      ? `${s.era.split("+")[0]}-${surname(first.name)[0]}-${surname(s.composers[s.composers.length - 1].name)[0]}`
      : first.formations
        ? `${surname(first.name)}-${first.label}`
        : (s.kind === "mid" ? [s.era.split("+")[0]] : []).concat(s.composers.slice(0, s.kind === "mid" ? 2 : 3).map((c) => surname(c.name))).join("-");
  s.slice = `${s.kind[0]}${n}_${label}`;
}

const total = (k?: string) => slices.filter((s) => !k || s.kind === k);
const sum = (xs: Slice[], f: (s: Slice) => number) => xs.reduce((n, s) => n + f(s), 0);
const groups = {
  _about:
    "Composer slices for the phase-2 curation agents (data/chamber/curation/AGENT_BRIEF.md), generated by scripts/chamber/curation_slices.ts " +
    "from the census. works = in-scope IMSLP works of the slice; " +
    "recorded = works IMSLP links to a commercial recording. A composer with 'formations' is split across slices by formation.",
  summary: Object.fromEntries(
    (["core", "mid", "tail"] as const).map((k) => [
      k,
      { slices: total(k).length, composers: new Set(total(k).flatMap((s) => s.composers.map((c) => c.name))).size, works: sum(total(k), (s) => s.works), recorded: sum(total(k), (s) => s.recorded) },
    ]),
  ),
  slices: Object.fromEntries(
    slices.map((s) => [
      s.slice,
      {
        kind: s.kind,
        era: s.era,
        region: s.region,
        works: s.works,
        recorded: s.recorded,
        composers: s.composers.map((c) => (c.formations ? { name: c.name, formations: c.formations } : c.name)),
      },
    ]),
  ),
};
mkdirSync(join(ROOT, "data/chamber/curation"), { recursive: true });
writeFileSync(join(ROOT, "data/chamber/curation/groups.json"), JSON.stringify(groups, null, 1) + "\n");
console.log(JSON.stringify(groups.summary));

// ---------- phase 3: the composers IMSLP does not cover ----------
// data/chamber/curation/groups-modern.json is written by hand; this reports, for each of its composers, what the census
// holds (their IMSLP candidates go into their phase-3 input, not into a phase-2 slice)
{
  const modern = modernPlan;
  const sliceOf = new Map<string, string[]>();
  for (const s of slices) for (const c of s.composers) sliceOf.set(c.name, [...(sliceOf.get(c.name) ?? []), s.slice]);
  const seen = new Map<string, string>();
  const violinComposers = new Set(violin.map((v) => v.composer));
  const coverage: Record<string, unknown> = {};
  for (const [slice, names] of Object.entries(modern.slices))
    for (const name of names) {
      if (seen.has(name)) throw new Error(`groups-modern.json: ${name} is in both ${seen.get(name)} and ${slice}`);
      seen.set(name, slice);
      const st = stats.get(name);
      coverage[name] = {
        slice,
        inViolinCatalogue: violinComposers.has(name),
        imslpWorks: st?.works ?? 0,
        imslpRecorded: st?.recorded ?? 0,
        benchmarks: benchmarks.filter((w) => w.composer === name).length,
      };
    }
  // benchmark composers must be somewhere
  for (const c of benchmarkComposers)
    if (!sliceOf.has(c) && !seen.has(c)) console.error(`benchmark composer ${c} is in no slice (add them to groups-modern.json)`);
  writeFileSync(
    join(ROOT, "data/chamber/curation/modern-coverage.json"),
    JSON.stringify({ _about: "Written by scripts/chamber/curation_slices.ts: each phase-3 composer's IMSLP coverage (their candidates are in their phase-3 input).", composers: coverage }, null, 1) + "\n",
  );
  const vals = Object.values(coverage) as { imslpWorks: number; inViolinCatalogue: boolean }[];
  console.log(
    `phase 3: ${Object.keys(modern.slices).length} slices, ${vals.length} composers (${vals.filter((v) => !v.imslpWorks).length} with no IMSLP candidates, ` +
      `${vals.filter((v) => !v.inViolinCatalogue).length} not in the violin catalogue)`,
  );
}

// ---------- inputs ----------
if (process.argv.includes("--inputs")) {
  const dir = join(ROOT, "data/chamber/curation/input");
  rmSync(dir, { recursive: true, force: true }); // slice names change when the census does
  mkdirSync(dir, { recursive: true });
  const matchById = new Map(matches.map((m) => [m.id, m]));
  const ENSEMBLE = /2 violins|3 violins|4 violins|continuo|quartet|quintet|trio|ensemble|strings/i;
  for (const s of slices) {
    const inSlice = (c: { composer: string; formation?: FormationKey }) =>
      s.composers.some((p) => p.name === c.composer && (!p.formations || (c.formation && p.formations.includes(c.formation))));
    // a split composer's benchmarks follow the formation; violin entries and out-of-scope pages go to the first part
    const firstPart = (name: string) => slices.find((x) => x.composers.some((p) => p.name === name)) === s;
    const names = new Set(s.composers.map((c) => c.name).filter(firstPart));
    const input = {
      slice: s.slice,
      kind: s.kind,
      gapCheck: s.kind === "core",
      composers: s.composers.map((p) => ({
        name: p.name,
        formations: p.formations ?? "all",
        core: s.kind === "core",
        inViolinCatalogue: nationality.has(p.name) || violin.some((v) => v.composer === p.name),
        works: p.works,
        recorded: p.recorded,
      })),
      candidates: candidates.filter((c) => inSlice(c)),
      benchmarks: benchmarks
        .filter((w) => inSlice(w))
        .map((w) => ({ id: w.id, composer: w.composer, title: w.title, formation: w.formation, level: w.level, imslpPage: matchById.get(w.id)?.imslpPage ?? null })),
      violin: violin
        .filter((v) => names.has(v.composer) && ENSEMBLE.test(v.accompaniment))
        .map((v) => ({ id: v.id, title: v.title, level: v.level, accompaniment: v.accompaniment, imslpPage: v.imslpPage ?? null })),
      outOfScope: outOfScope.filter((o) => names.has(o.composer)),
    };
    writeFileSync(join(dir, `${s.slice}.json`), JSON.stringify(input, null, 1) + "\n");
  }
  // phase-3 slices: the composers, what IMSLP and the phase-2 slices already hold, benchmarks and violin entries
  const modern: { slices: Record<string, string[]> } = read("data/chamber/curation/groups-modern.json");
  const coverage = read("data/chamber/curation/modern-coverage.json").composers;
  for (const [slice, names] of Object.entries(modern.slices)) {
    const set = new Set(names);
    const input = {
      slice,
      kind: "modern",
      gapCheck: true,
      composers: names.map((name) => ({ name, core: true, ...coverage[name] })),
      candidates: candidates.filter((c) => set.has(c.composer)),
      benchmarks: benchmarks
        .filter((w) => set.has(w.composer))
        .map((w) => ({ id: w.id, composer: w.composer, title: w.title, formation: w.formation, level: w.level, imslpPage: matchById.get(w.id)?.imslpPage ?? null })),
      violin: violin
        .filter((v) => set.has(v.composer) && ENSEMBLE.test(v.accompaniment))
        .map((v) => ({ id: v.id, title: v.title, level: v.level, accompaniment: v.accompaniment, imslpPage: v.imslpPage ?? null })),
      outOfScope: outOfScope.filter((o) => set.has(o.composer)),
    };
    writeFileSync(join(dir, `${slice}.json`), JSON.stringify(input, null, 1) + "\n");
  }
  console.log(`${slices.length + Object.keys(modern.slices).length} input files in data/chamber/curation/input/`);
}
