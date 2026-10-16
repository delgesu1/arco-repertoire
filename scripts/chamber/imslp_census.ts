/**
 * Phase 2 census, step 2 (docs/chamber-music-plan.md): turn the IMSLP category harvest into counts and a candidate list.
 *
 * Reads   data/cache/imslp-chamber/{members/,cats.jsonl,sweep-members.json,pages.jsonl,signals/}  (scripts/chamber/imslp_harvest.py)
 *         data/cache/imslp-all/pages/*.json, resolve.json   the earlier composer harvest (pages reused, IMSLP names → catalogue names)
 *         data/chamber/imslp-instruments.json              IMSLP instrument names → InstrumentKey (fails on a name it does not know)
 *         data/chamber/imslp-composers.json                IMSLP composer names → house spelling, where resolve.json does not map them
 *         data/chamber/works.json, composers.json, benchmarks/verify/*.json, data/build/catalogue.json
 * Writes  data/chamber/census/census.json          every count below, machine-readable
 *         data/chamber/census/CENSUS.md            the same for reading
 *         data/chamber/census/candidates.jsonl     one line per in-scope IMSLP page (the curators' input), sorted by composer
 *         data/chamber/census/out-of-scope.jsonl   pages with a string part that the scope rules leave out, with the reason
 *         data/chamber/census/benchmark-matches.json  each of the 135 benchmarks with its IMSLP page, if found
 *
 *   npx tsx scripts/chamber/imslp_census.ts
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberComposer, ChamberWork, FormationKey, InstrumentKey } from "../../lib/chamber/types";
import { FORMATIONS, INSTRUMENTS, formationFor, playersFor } from "../../lib/chamber/vocab";
import type { Catalogue, EraKey } from "../../lib/types";

const ROOT = join(__dirname, "..", "..");
const CACHE = join(ROOT, "data/cache/imslp-chamber");
const OUT = join(ROOT, "data/chamber/census");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const jsonl = <T>(p: string): T[] =>
  existsSync(p) ? readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as T) : [];

type Ins = Partial<Record<InstrumentKey, number>>;
interface Row {
  title: string;
  pageid: number | null;
  info: Record<string, string>;
  nfiles: number;
  arrs: { heading: string }[];
  cats: string[];
}

// ---------- instrument names ----------
const MAP: Record<string, string | Record<string, number>> = read("data/chamber/imslp-instruments.json");
delete MAP._about;
for (const [name, v] of Object.entries(MAP)) {
  const keys = typeof v === "string" ? (v.startsWith("!") ? [] : [v]) : Object.keys(v);
  for (const k of keys) if (!(k in INSTRUMENTS)) throw new Error(`imslp-instruments.json "${name}": "${k}" is not an InstrumentKey`);
}
const FOLD_INTO_CONTINUO = new Set(["violone"]); // a violone beside the continuo plays its bass line: one continuo player
const unknown = new Map<string, number>();

interface Scoring {
  name: string; // the category name after "For "
  ins: Ins;
  out: string[]; // reasons this scoring is outside the section
  folded: boolean; // a violone was folded into the continuo
}

/** "2 violins, viola, cello" → {violin: 2, viola: 1, cello: 1}; null for class categories ("voices with keyboard", "3 players") */
function parseScoring(name: string): Scoring | null {
  if (/\bwith\b/.test(name) || /^\d+ players?$/.test(name)) return null;
  const s: Scoring = { name, ins: {}, out: [], folded: false };
  let violone = 0;
  for (const raw of name.split(/,\s*|\s+and\s+/)) {
    const m = raw.trim().match(/^(\d+)\s+(.+)$/);
    const count = m ? Number(m[1]) : null;
    const word = (m ? m[2] : raw).trim();
    let v = MAP[word];
    let plural = false;
    if (v === undefined && word.endsWith("es") && MAP[word.slice(0, -2)] !== undefined) [v, plural] = [MAP[word.slice(0, -2)], true];
    if (v === undefined && word.endsWith("s") && MAP[word.slice(0, -1)] !== undefined) [v, plural] = [MAP[word.slice(0, -1)], true];
    if (v === undefined) {
      unknown.set(word, (unknown.get(word) ?? 0) + 1);
      continue;
    }
    if (typeof v === "string" && v.startsWith("!")) {
      s.out.push(v.slice(1));
      continue;
    }
    if (plural && count == null) {
      s.out.push(`unspecified number of ${word}`);
      continue;
    }
    // an object is the whole part ("2 pianos 8 hands" is 4 players), a key is one player times the count
    const add = typeof v === "string" ? { [v]: count ?? 1 } : v;
    for (const [k, c] of Object.entries(add)) s.ins[k as InstrumentKey] = (s.ins[k as InstrumentKey] ?? 0) + c;
    const n = count ?? 1;
    if (FOLD_INTO_CONTINUO.has(word.replace(/s$/, ""))) violone += n;
  }
  // the fold applies to trio texture (two upper parts over the bass); with one upper part the violone is obbligato
  // (Buxtehude's sonatas for viol, violone and continuo), so it stays a player
  if (violone && s.ins.continuo && s.ins["double-bass"]) {
    const folded: Ins = { ...s.ins, "double-bass": s.ins["double-bass"] - violone };
    if (!folded["double-bass"]) delete folded["double-bass"];
    if (playersFor(folded) >= 3) [s.ins, s.folded] = [folded, true];
  }
  return s;
}

const isString = (k: InstrumentKey) => INSTRUMENTS[k].family === "string";
const keysOf = (ins: Ins) => Object.keys(ins) as InstrumentKey[];

/** why a scoring is outside the section, or null when it is in scope */
function scopeReason(s: Scoring): string | null {
  if (s.out.length) return s.out[0];
  const p = playersFor(s.ins);
  if (!keysOf(s.ins).some(isString)) return "no string part";
  if (p < 3) return "fewer than 3 players";
  if (p > 9) return "more than 9 players";
  if (keysOf(s.ins).every((k) => k === "violin")) return "violins alone (violin section)";
  return null;
}

// ---------- pages ----------
const ORIGINAL = /^For (?!\d+ players)(.+)$/;
const scoringsOf = (cats: string[]) =>
  cats
    .filter((c) => !c.endsWith("(arr)"))
    .map((c) => c.match(ORIGINAL)?.[1])
    .filter((x): x is string => !!x)
    .map(parseScoring)
    .filter((x): x is Scoring => !!x);

const oldDir = join(ROOT, "data/cache/imslp-all/pages");
const allCats = new Map<string, string[]>();
for (const f of readdirSync(oldDir)) for (const r of JSON.parse(readFileSync(join(oldDir, f), "utf8")).rows) allCats.set(r.title, r.cats);
for (const r of jsonl<{ title: string; cats: string[] }>(join(CACHE, "cats.jsonl"))) allCats.set(r.title, r.cats);

const found = new Map<string, string[]>(); // page → the player-count categories it was found in
for (const f of readdirSync(join(CACHE, "members"))) {
  const cat = f.replace(/\.json$/, "");
  for (const [t] of JSON.parse(readFileSync(join(CACHE, "members", f), "utf8"))) found.set(t, [...(found.get(t) ?? []), cat]);
}
const sweepFile = join(CACHE, "sweep-members.json");
const swept: [string, number][] = existsSync(sweepFile) ? JSON.parse(readFileSync(sweepFile, "utf8")) : [];
for (const [t] of swept) if (!found.has(t)) found.set(t, ["sweep"]);

const rows = new Map<string, Row>();
for (const r of jsonl<Row>(join(CACHE, "pages.jsonl"))) rows.set(r.title, r);

const signal = (name: string) => {
  const f = join(CACHE, "signals", `${name}.json`);
  return new Set<string>(existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : []);
};
const RECORDED = signal("pages-with-commercial-recordings");
const FIRST_ED = signal("pages-with-first-editions");
const HOFMEISTER = signal("pages-with-references-to-hofmeister-s-monatsbericht");
const AUDIO = signal("recordings");
const haveSignals = RECORDED.size > 0;

// ---------- composers and eras ----------
const violin = (read("data/build/catalogue.json") as Catalogue).pieces;
const chamberComposers: Record<string, ChamberComposer> = read("data/chamber/composers.json");
const resolve: Record<string, { category?: string }> = read("data/cache/imslp-all/resolve.json");
const imslpToCatalogue = new Map<string, string>();
for (const [name, v] of Object.entries(resolve)) if (v.category) imslpToCatalogue.set(v.category, name);
const aliases: Record<string, string> = read("data/chamber/imslp-composers.json");
for (const [imslp, name] of Object.entries(aliases)) if (imslp !== "_about") imslpToCatalogue.set(imslp, name);
const composerEra = new Map<string, EraKey>();
{
  const tally = new Map<string, Map<EraKey, number>>();
  for (const p of violin) {
    const m = tally.get(p.composer) ?? new Map();
    m.set(p.era, (m.get(p.era) ?? 0) + 1);
    tally.set(p.composer, m);
  }
  for (const [c, m] of tally) composerEra.set(c, [...m].sort((a, b) => b[1] - a[1])[0][0]);
  for (const [c, v] of Object.entries(chamberComposers)) if (!composerEra.has(c)) composerEra.set(c, v.era);
}
const violinPages = new Map(violin.filter((p) => p.imslpPage).map((p) => [p.imslpPage!, p]));

const composerOf = (title: string) => {
  const m = title.match(/\(([^()]+)\)\s*$/);
  const raw = m ? m[1].trim() : "";
  return imslpToCatalogue.get(raw) ?? raw;
};
const yearOf = (info: Record<string, string>) => {
  for (const f of ["Year/Date of Composition", "Year of First Publication"]) {
    const m = info[f]?.match(/1[0-9]{3}/);
    if (m) return Number(m[0]);
  }
  return null;
};
type EraBucket = EraKey | "early-music" | "unknown";
function eraOf(composer: string, info: Record<string, string>, year: number | null): EraBucket {
  const known = composerEra.get(composer);
  if (known) return known;
  const style = info["Piece Style"] ?? "";
  if (/Medieval|Renaissance/.test(style)) return "early-music";
  if (/Baroque/.test(style)) return "baroque";
  if (/Classical/.test(style)) return "classical";
  if (/Romantic/.test(style)) return year != null && year < 1850 ? "early-romantic" : "late-romantic";
  if (/Early 20th/.test(style)) return "20th-century";
  if (/Modern/.test(style)) return year != null && year >= 1975 ? "contemporary" : "20th-century";
  return "unknown";
}
const minutesOf = (d: string | undefined) => {
  if (!d) return null;
  let m = 0;
  const h = d.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/i);
  if (h) m += Number(h[1]) * 60;
  const r = d.match(/(\d+)\s*[-–]\s*(\d+)\s*(?:min|')/i) ?? d.match(/(\d+)\s*(?:min|')/i);
  if (r) m += r[2] ? (Number(r[1]) + Number(r[2])) / 2 : Number(r[1]);
  return m ? Math.round(m) : null;
};

// ---------- collections and sets ----------
const MULTI =
  /^(\d+)\s+(?:\w+\s+){0,3}(quartets?|quintets?|trios?|sextets?|septets?|octets?|nonets?|sonatas?|sonates|sonaten|divertiment[io]s?|divertissements?|serenades?|serenaten|notturni|nocturnes|sinfonias?|concert[io]s?|quatuors|quartette|quartetti|quintetti|terzetti|cassations?)\b/i;
/** how many catalogue works one page holds: "6 String Quartets, Op.18" → 6; a set of pieces ("5 Novelettes") stays one */
const worksIn = (title: string) => {
  const m = title.replace(/\s*\([^()]*\)\s*$/, "").match(MULTI);
  return m ? Number(m[1]) : 1;
};

// ---------- flags ----------
const PEDAGOGICAL = /\b(easy|leichte?n?|faciles?|progressive|instructive|for (?:beginners|students|young players|children)|pour les commen[cç]ants|f[üu]r anf[äa]nger|kinder|jugend|school|method|méthode|schule|exercises?|études? progressives?|pedagog)/i;
const PEDAGOGICAL_CAT = /^(Pedagogical|Exercises|Methods|For beginners|For students|Studies)$/i;
const FRAGMENT = /fragment|incomplete|unfinished|sketch/i;
// IMSLP categories that say nothing about the work (projects, collections, file types, licences, languages) or that the
// signals already carry; "Urtext" and "Works reprinted by Edwin F. Kalmus" stay (they hint at a modern edition)
const GENRE_NOISE =
  /^(Works not in public domain|Sibley Mirroring Project|Manuscripts|Recordings|WIMA files|Merton Parts|Work pages with links to recordings|Submission Project|Unknown (arrangement )?tag|NoAutoTag|Works with Braille scores|Gardner Museum Recordings|WorkPD-USonly|Work-PD-US-notrenewed|Anonymous|Collections|Pending)$|^(Manuscripts from|Composers' holographs|Recordings published|Works from the)|Collection$| language$/;

// ---------- classify every page with a string part ----------
interface Candidate {
  title: string;
  composer: string;
  era: EraBucket;
  formation: FormationKey;
  instruments: Ins;
  players: number;
  scoring: string;
  alsoScored: string[];
  workTitle: string;
  opus: string;
  key: string;
  year: number | null;
  firstPublished: string;
  minutes: number | null;
  works: number; // catalogue works this page holds (sets of quartets etc.)
  setsDupe: boolean; // a collection page whose works also have their own pages
  nfiles: number;
  recorded: boolean;
  firstEdition: boolean;
  hofmeister: boolean;
  audio: boolean;
  published: boolean;
  manuscriptOnly: boolean;
  upload: boolean; // IMSLP "Works not in public domain": mostly living composers' own uploads
  linked: boolean; // IMSLP "Work pages with links to recordings" (any recording link, often the composer's own)
  voice: boolean;
  viols: boolean;
  folded: boolean; // a violone beside the continuo was counted as part of it
  pedagogical: boolean;
  fragment: boolean;
  collection: boolean;
  concerto: boolean; // IMSLP files it under "Concertos": often orchestral, sometimes one player to a part
  violinId?: number;
  cats: string[]; // genre categories (scoring, style, key and composer categories left out)
}

const STRING_WORD = /violin|viola|cello|double bass|violone|\bviols?\b|gamba|baryton|arpeggione|\bstrings?\b|bass instrument/i;
const candidates: Candidate[] = [];
const outOfScope: { title: string; composer: string; reason: string; scorings: string[] }[] = [];
const missingRows: string[] = [];
let pagesWithStringScoring = 0;

for (const [title] of found) {
  const cats = allCats.get(title) ?? [];
  const scorings = scoringsOf(cats);
  const stringy = cats.some((c) => !c.endsWith("(arr)") && ORIGINAL.test(c) && STRING_WORD.test(c));
  if (!stringy) continue;
  pagesWithStringScoring++;
  const composer = composerOf(title);
  const inScope = scorings.filter((s) => !scopeReason(s));
  if (!inScope.length) {
    const reasons = scorings.map(scopeReason).filter((r): r is string => !!r);
    const order = [
      "violins alone (violin section)",
      "fewer than 3 players",
      "more than 9 players",
      "baryton (Haydn's baryton works are out, decision 3)",
    ];
    const reason =
      order.find((r) => reasons.includes(r)) ??
      reasons.find((r) => r !== "no string part") ??
      (scorings.length ? "no string part" : "only class categories (no specific scoring)");
    outOfScope.push({ title, composer, reason, scorings: scorings.map((s) => s.name) });
    continue;
  }
  const row = rows.get(title);
  if (!row) {
    missingRows.push(title);
    continue;
  }
  const info = row.info ?? {};
  const instr = (info.Instrumentation ?? "").toLowerCase();
  const fit = (s: Scoring) => keysOf(s.ins).filter((k) => instr.includes(INSTRUMENTS[k].label.split(" ")[0])).length;
  // the fewest players, then the scoring the work info names, then a named formation over "other" (a keyboard trio
  // listed both "with harpsichord" and "with piano" is a piano trio), then alphabetical
  const named = (s: Scoring) => (formationFor(s.ins) === "other" ? 0 : 1);
  const best = [...inScope].sort(
    (a, b) => playersFor(a.ins) - playersFor(b.ins) || fit(b) - fit(a) || named(b) - named(a) || a.name.localeCompare(b.name),
  )[0];
  const year = yearOf(info);
  const genre = cats.filter(
    (c) =>
      !/^For |^Scores|^[A-G](-flat|-sharp)? (major|minor)$|style$|^(Baroque|Classical|Romantic|Early 20th century|Modern|Medieval|Renaissance)$|\//.test(c) &&
      !c.includes(",") &&
      !GENRE_NOISE.test(c),
  );
  const keys = keysOf(best.ins);
  candidates.push({
    title,
    composer,
    era: eraOf(composer, info, year),
    formation: formationFor(best.ins),
    instruments: best.ins,
    players: playersFor(best.ins),
    scoring: best.name,
    alsoScored: inScope.filter((s) => s !== best).map((s) => s.name),
    workTitle: info["Work Title"] ?? "",
    opus: info["Opus/Catalogue Number"] ?? "",
    key: info.Key ?? "",
    year,
    firstPublished: info["Year of First Publication"] ?? "",
    minutes: minutesOf(info["Average Duration"]),
    works: worksIn(title),
    setsDupe: false,
    nfiles: row.nfiles ?? 0,
    recorded: RECORDED.has(title),
    firstEdition: FIRST_ED.has(title),
    hofmeister: HOFMEISTER.has(title),
    audio: AUDIO.has(title),
    published: !!info["Year of First Publication"] || FIRST_ED.has(title) || HOFMEISTER.has(title),
    manuscriptOnly: !info["Year of First Publication"] && !FIRST_ED.has(title) && !HOFMEISTER.has(title) && cats.includes("Manuscripts"),
    upload: cats.includes("Works not in public domain"),
    linked: cats.includes("Work pages with links to recordings"),
    voice: keys.includes("voice"),
    viols: keys.every((k) => k === "viola-da-gamba"),
    folded: best.folded,
    pedagogical: PEDAGOGICAL.test(`${title} ${info["Alternative Title"] ?? ""}`) || cats.some((c) => PEDAGOGICAL_CAT.test(c)),
    fragment: FRAGMENT.test(`${title} ${info["Number of Movements/Sections"] ?? ""}`) || cats.includes("Incomplete works"),
    collection: cats.some((c) => /\/(Collections|Collected Works)$/.test(c)) || worksIn(title) > 1,
    concerto: cats.includes("Concertos"),
    violinId: violinPages.get(title)?.id,
    cats: genre,
  });
}

if (unknown.size) {
  console.error(
    `imslp-instruments.json does not know ${unknown.size} name(s); add them:\n` +
      [...unknown].sort((a, b) => b[1] - a[1]).map(([n, c]) => `  "${n}" (${c})`).join("\n"),
  );
  process.exit(1);
}

// collections: a page for a whole opus ("6 String Quartets, Op.76") or a complete edition ("83 Quartette") adds only
// the works that have no page of their own (same composer, formation and opus number)
{
  const opusNumbers = (c: Candidate) => [...new Set([...`${c.title} ${c.opus}`.matchAll(/\bOp(?:us)?\.?\s*(\d+)/gi)].map((m) => m[1]))];
  const singles = new Map<string, number>();
  const bump = (k: string) => singles.set(k, (singles.get(k) ?? 0) + 1);
  for (const c of candidates.filter((c) => !c.collection)) {
    bump(`${c.composer}|${c.formation}`);
    for (const o of opusNumbers(c)) bump(`${c.composer}|${c.formation}|${o}`);
  }
  for (const c of candidates.filter((c) => c.collection)) {
    const ops = opusNumbers(c);
    const own = ops.reduce((n, o) => n + (singles.get(`${c.composer}|${c.formation}|${o}`) ?? 0), 0);
    const anthology = !ops.length && (c.works > 12 || c.works === 1) && (singles.get(`${c.composer}|${c.formation}`) ?? 0) >= 3;
    const covered = own || (anthology ? singles.get(`${c.composer}|${c.formation}`)! : 0);
    if (covered) {
      c.setsDupe = true;
      c.works = Math.max(0, c.works - covered);
    }
  }
}

// ---------- the 135 benchmarks ----------
const works: ChamberWork[] = read("data/chamber/works.json");
const verifyLinks = new Map<number, string[]>();
const linksFile = join(CACHE, "benchmark-links.json"); // the links through IMSLP's redirects (harvest step "benchmarks")
const linkTarget: Record<string, string> = existsSync(linksFile) ? JSON.parse(readFileSync(linksFile, "utf8")) : {};
const vdir = join(ROOT, "data/chamber/benchmarks/verify");
for (const f of readdirSync(vdir).filter((f) => f.endsWith(".json")))
  for (const r of JSON.parse(readFileSync(join(vdir, f), "utf8")).results ?? [])
    for (const u of r.sources ?? [])
      if (/imslp\.org\/wiki\//.test(u)) {
        const t = decodeURIComponent(u.split("/wiki/")[1].split("#")[0]).replace(/_/g, " ");
        if (!t.startsWith("Category:")) verifyLinks.set(r.id, [...(verifyLinks.get(r.id) ?? []), linkTarget[t] ?? t]);
      }
const byComposer = new Map<string, Candidate[]>();
for (const c of candidates) byComposer.set(c.composer, [...(byComposer.get(c.composer) ?? []), c]);
const catNumbers = (s: string) =>
  [...s.matchAll(/\b(Op\.?\s*\d+[a-z]?(?:,?\s*No\.?\s*\d+)?|[A-Z][A-Za-z]{0,3}\.?\s*[IVX]*:?\s*\d+[a-z]?)/g)].map((m) =>
    m[1].toLowerCase().replace(/[\s.,]/g, ""),
  );
const outByTitle = new Map(outOfScope.map((o) => [o.title, o]));
const benchmarkMatches = works.map((w) => {
  const linked = (verifyLinks.get(w.id) ?? []).concat(w.imslpPage ? [w.imslpPage] : []);
  let page = linked.find((t) => found.has(t) || allCats.has(t)) ?? linked[0] ?? null;
  let how = page ? "verify link" : "none";
  if (!page) {
    const nums = catNumbers(w.title).filter((n) => /\d/.test(n));
    const hit = (byComposer.get(w.composer) ?? []).find((c) => {
      const theirs = catNumbers(`${c.title} ${c.opus}`);
      return nums.length && nums.every((n) => theirs.includes(n));
    });
    if (hit) [page, how] = [hit.title, "catalogue number"];
  }
  const cand = page ? candidates.find((c) => c.title === page) : undefined;
  return {
    id: w.id,
    composer: w.composer,
    title: w.title,
    imslpPage: page,
    how,
    harvested: page ? found.has(page) : false,
    candidate: !!cand,
    outOfScope: page ? outByTitle.get(page)?.reason ?? null : null,
    recorded: page ? RECORDED.has(page) : null,
    published: cand ? cand.published : null,
  };
});

// ---------- counts ----------
interface SampleRow {
  tier: string;
  works: number;
  checked: number;
  recorded: number;
  unsure: number;
  modernEdition: number;
  workShareRecorded: number;
  pageShareInterval: number[];
  estimatedPass: number;
  estimatedRange: number[];
}
const tally = <T>(xs: T[], key: (x: T) => string, weight: (x: T) => number = () => 1) => {
  const m: Record<string, number> = {};
  for (const x of xs) m[key(x)] = (m[key(x)] ?? 0) + weight(x);
  return Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));
};
const W = (c: Candidate) => c.works;
const keep = candidates.filter((c) => !c.voice && !c.viols);
const ERA_ORDER: EraBucket[] = ["early-music", "baroque", "classical", "early-romantic", "late-romantic", "20th-century", "contemporary", "unknown"];
const formationByEra: Record<string, Record<string, number>> = {};
for (const f of FORMATIONS) {
  formationByEra[f.key] = {};
  for (const e of ERA_ORDER) formationByEra[f.key][e] = 0;
}
for (const c of candidates) formationByEra[c.formation][c.era] += c.works;

const floorTier = (c: Candidate) =>
  c.recorded
    ? "A recorded"
    : c.upload
      ? "C not public domain (recent uploads), no recording found"
      : c.published
        ? "B published, no recording found"
        : c.manuscriptOnly
          ? "D manuscript only"
          : "E no publication data";
const composerRows = Object.entries(tally(candidates, (c) => c.composer, W)).map(([composer, n]) => {
  const cs = byComposer.get(composer) ?? [];
  return {
    composer,
    works: n,
    pages: cs.length,
    recorded: cs.filter((c) => c.recorded).reduce((s, c) => s + c.works, 0),
    published: cs.filter((c) => c.published).reduce((s, c) => s + c.works, 0),
    inViolinCatalogue: composerEra.has(composer) && !chamberComposers[composer],
    era: cs[0]?.era ?? "unknown",
    formations: tally(cs, (c) => c.formation, W),
  };
});

const bmFound = benchmarkMatches.filter((b) => b.imslpPage);
const bmCand = benchmarkMatches.filter((b) => b.candidate);
const recall = bmCand.length ? bmCand.filter((b) => b.recorded).length / bmCand.length : 0;
const sum = (xs: Candidate[]) => xs.reduce((s, c) => s + c.works, 0);
const census = {
  generated: new Date().toISOString().slice(0, 10),
  source: "IMSLP categories For 3–9 players and For 2–8 players with continuo, plus a sweep of their scoring categories",
  pages: {
    found: found.size,
    sweptIn: swept.length,
    withStringScoring: pagesWithStringScoring,
    outOfScope: outOfScope.length,
    candidates: candidates.length,
    missingRows: missingRows.length,
  },
  outOfScopeReasons: tally(outOfScope, (o) => o.reason),
  works: {
    candidates: sum(candidates),
    withVoice: sum(candidates.filter((c) => c.voice)),
    violConsort: sum(candidates.filter((c) => c.viols)),
    instrumentalNotViols: sum(keep),
    collectionPagesDeduplicated: candidates.filter((c) => c.setsDupe).length,
    pedagogicalFlag: sum(candidates.filter((c) => c.pedagogical)),
    fragmentFlag: sum(candidates.filter((c) => c.fragment)),
    crossListedWithViolin: candidates.filter((c) => c.violinId).length,
  },
  byFormation: tally(candidates, (c) => c.formation, W),
  byPlayers: tally(candidates, (c) => String(c.players), W),
  byEra: Object.fromEntries(ERA_ORDER.map((e) => [e, sum(candidates.filter((c) => c.era === e))])),
  formationByEra,
  byInstrument: tally(candidates.flatMap((c) => keysOf(c.instruments).map((k) => ({ k, w: c.works }))), (x) => x.k, (x) => x.w),
  composers: { count: composerRows.length, withOneWork: composerRows.filter((r) => r.works === 1).length },
  topComposers: composerRows.slice(0, 60),
  concentration: (() => {
    const total = sum(candidates);
    const top = (n: number) => composerRows.slice(0, n).reduce((s, r) => s + r.works, 0);
    return { top5: top(5) / total, top20: top(20) / total, top100: top(100) / total };
  })(),
  floor: {
    signalsLoaded: haveSignals,
    benchmarkRecallOfRecordingSignal: recall,
    note: "",
    estimate: {} as Record<string, number>,
    tiers: {} as Record<string, number>,
    sample: null as SampleRow[] | null,
    openGroups: {} as Record<string, { works: number; recorded: number }>,
  },
  benchmarks: {
    total: works.length,
    imslpPageFound: bmFound.length,
    harvested: benchmarkMatches.filter((b) => b.harvested).length,
    candidates: bmCand.length,
    outOfScope: tally(benchmarkMatches.filter((b) => b.outOfScope), (b) => b.outOfScope!),
    recorded: bmCand.filter((b) => b.recorded).length,
  },
};

// ---------- floor estimate ----------
// The pool is the instrumental candidates (vocal works and viol consorts wait for the owner's decision; pedagogical and
// fragment flags are left out). Without a sample: the recorded tier, plus the recorded works the signal misses at its
// benchmark recall. With the 120-page sample (data/chamber/census/floor-sample/, checked against recording catalogues by
// subagents): each tier's share of works with a commercial recording, times the tier's works.
const pool = candidates.filter((c) => !c.voice && !c.viols && !c.pedagogical && !c.fragment && c.works > 0);
const poolTiers = tally(pool, floorTier, W);
const TIERS = Object.keys(poolTiers).sort();
const sampleDir = join(OUT, "floor-sample");
const sampleTier: Record<string, string> = existsSync(join(sampleDir, "tiers.json")) ? JSON.parse(readFileSync(join(sampleDir, "tiers.json"), "utf8")) : {};
const sampleItems = new Map<string, { works: number }>();
const sampleResults: { key: string; recorded: string; recorded_works?: number; modern_edition?: string }[] = [];
for (const g of ["s1", "s2", "s3"]) {
  const inF = join(sampleDir, `${g}.json`);
  const outF = join(sampleDir, `results-${g}.json`);
  if (existsSync(inF)) for (const it of JSON.parse(readFileSync(inF, "utf8")).items) sampleItems.set(it.key, it);
  if (existsSync(outF)) sampleResults.push(...JSON.parse(readFileSync(outF, "utf8")).results);
}
const wilson = (k: number, n: number) => {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
};
const tierLetter = (t: string) => t[0];
const sampleByTier: SampleRow[] = TIERS.map((t) => {
  const rs = sampleResults.filter((r) => sampleTier[r.key] === tierLetter(t));
  const yes = rs.filter((r) => r.recorded === "yes");
  const unsure = rs.filter((r) => r.recorded === "unsure");
  const works = rs.reduce((n, r) => n + (sampleItems.get(r.key)?.works ?? 1), 0);
  const recWorks = yes.reduce((n, r) => n + Math.min(sampleItems.get(r.key)?.works ?? 1, r.recorded_works || (sampleItems.get(r.key)?.works ?? 1)), 0);
  const rate = works ? recWorks / works : 0;
  const [lo, hi] = wilson(yes.length, rs.length);
  return {
    tier: t,
    works: poolTiers[t],
    checked: rs.length,
    recorded: yes.length,
    unsure: unsure.length,
    modernEdition: rs.filter((r) => r.modern_edition === "yes").length,
    workShareRecorded: Math.round(rate * 1000) / 1000,
    pageShareInterval: [Math.round(lo * 100) / 100, Math.round(hi * 100) / 100],
    estimatedPass: Math.round(rate * poolTiers[t]),
    estimatedRange: [Math.round(lo * poolTiers[t]), Math.round(hi * poolTiers[t])],
  };
});
const sampled = sampleResults.length > 0;
{
  const A = poolTiers["A recorded"] ?? 0;
  const B = poolTiers["B published, no recording found"] ?? 0;
  const missed = recall > 0 ? Math.min(B, Math.round(A * (1 / recall - 1))) : 0;
  census.floor.estimate = sampled
    ? {
        pool: sum(pool),
        estimatedPass: sampleByTier.reduce((n, t) => n + t.estimatedPass, 0),
        low: sampleByTier.reduce((n, t) => n + t.estimatedRange[0], 0),
        high: sampleByTier.reduce((n, t) => n + t.estimatedRange[1], 0),
        recordedSignal: A,
      }
    : { pool: sum(pool), recordedSignal: A, publishedNoSignal: B, likelyPass: A + missed, upperBound: A + B };
  census.floor.note = sampled
    ? `Pool: ${sum(pool)} instrumental works (vocal, viol-consort, pedagogical and fragment flags left out). ${sampleResults.length} randomly drawn pages, ` +
      "stratified by tier, were checked for a commercial recording; each tier's recorded share of works times its works gives the estimate, " +
      "the 95% Wilson interval of the page share gives the range. The recording test is stricter than the floor (a performed but unrecorded work also passes)."
    : "Recall-based: recorded tier plus recorded × (1/recall − 1) from the benchmarks; upperBound = recorded + published.";
}
census.floor.tiers = poolTiers;
census.floor.sample = sampled ? sampleByTier : null;
census.floor.openGroups = {
  voice: { works: sum(candidates.filter((c) => c.voice)), recorded: sum(candidates.filter((c) => c.voice && c.recorded)) },
  viols: { works: sum(candidates.filter((c) => c.viols)), recorded: sum(candidates.filter((c) => c.viols && c.recorded)) },
};

// ---------- write ----------
mkdirSync(OUT, { recursive: true });
writeFileSync(join(OUT, "census.json"), JSON.stringify(census, null, 1) + "\n");
const compact = (c: Candidate) => ({
  composer: c.composer,
  title: c.title,
  formation: c.formation,
  instruments: c.instruments,
  players: c.players,
  scoring: c.scoring,
  ...(c.alsoScored.length ? { alsoScored: c.alsoScored } : {}),
  opus: c.opus,
  key: c.key,
  year: c.year,
  firstPublished: c.firstPublished,
  minutes: c.minutes,
  works: c.works,
  era: c.era,
  signals: [c.recorded && "recorded", c.firstEdition && "first-edition", c.hofmeister && "hofmeister", c.audio && "audio", c.linked && "recording-link", c.published && "published", c.manuscriptOnly && "manuscript-only", c.upload && "not-public-domain"].filter(Boolean),
  flags: [c.voice && "voice", c.viols && "viols", c.folded && "violone-folded-into-continuo", c.pedagogical && "pedagogical?", c.fragment && "fragment?", c.collection && "collection", c.setsDupe && "set-also-on-own-pages", c.concerto && "concerto?"].filter(Boolean),
  ...(c.violinId ? { violinId: c.violinId } : {}),
  genre: c.cats,
});
const byComposerTitle = (a: { composer: string; title: string }, b: { composer: string; title: string }) =>
  a.composer.localeCompare(b.composer) || a.title.localeCompare(b.title);
writeFileSync(join(OUT, "candidates.jsonl"), candidates.sort(byComposerTitle).map((c) => JSON.stringify(compact(c))).join("\n") + "\n");
writeFileSync(join(OUT, "out-of-scope.jsonl"), outOfScope.sort(byComposerTitle).map((o) => JSON.stringify(o)).join("\n") + "\n");
writeFileSync(join(OUT, "benchmark-matches.json"), JSON.stringify(benchmarkMatches, null, 1) + "\n");

// ---------- CENSUS.md ----------
{
  const n = (x: number) => x.toLocaleString("en-GB");
  const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
  const table = (head: string[], rows: (string | number)[][]) =>
    [`| ${head.join(" | ")} |`, `|${head.map((_, i) => (i ? "---:" : "---")).join("|")}|`, ...rows.map((r) => `| ${r.map((x) => (typeof x === "number" ? n(x) : x)).join(" | ")} |`)].join("\n");
  const recW = (xs: Candidate[]) => sum(xs.filter((c) => c.recorded));
  const label = (f: FormationKey) => FORMATIONS.find((x) => x.key === f)!.singular;
  const ERA_LABEL: Record<string, string> = {
    "early-music": "Before 1600", baroque: "Baroque", classical: "Classical", "early-romantic": "Early Romantic", "late-romantic": "Late Romantic",
    "20th-century": "20th century", contemporary: "Contemporary", unknown: "Unknown",
  };
  const total = sum(candidates);
  const inst = candidates.filter((c) => !c.voice && !c.viols);
  const est = census.floor.estimate as Record<string, number>;
  const sampleRows = census.floor.sample;
  const top = composerRows.slice(0, 40);
  // over the instrumental pool, leaving out Anonymous and Various (collections, not composers)
  const swamp = Object.entries(tally(pool, (c) => c.composer, W))
    .map(([composer, works]) => ({ composer, works, recorded: sum(pool.filter((c) => c.composer === composer && c.recorded)) }))
    .filter((r) => !/^(Anonymous|Various)$/.test(r.composer));
  const big = swamp.filter((r) => r.works >= 80 && r.recorded / r.works >= 0.2);
  swamp.splice(0, swamp.length, ...swamp.filter((r) => r.works >= 80 && r.recorded / r.works < 0.2));
  const open = census.floor.openGroups;
  const notInVocab = Object.entries(census.outOfScopeReasons).filter(([r]) => r.includes("not in the vocabulary"));
  const lines = [
    "# Chamber music census (IMSLP)",
    "",
    `Generated ${census.generated} by \`npx tsx scripts/chamber/imslp_census.ts\` from the harvest of \`python3 scripts/chamber/imslp_harvest.py\` (cache in \`data/cache/imslp-chamber/\`, not in git). Phase 2 of \`docs/chamber-music-plan.md\`.`,
    "",
    "## Method",
    `- **Harvest by scoring category.** Every page in IMSLP's \"For 3 players\" … \"For 9 players\" and \"For 2 players with continuo\" … \"For 8 players with continuo\" (continuo counts as one player), ${n(found.size - swept.length)} pages; then a sweep of the scoring categories those pages use (\"For 2 violins, viola, cello\" …) added ${n(swept.length)} pages that IMSLP files under a scoring but not under a player count (mostly works with voice, which IMSLP does not count as a player). ${n(rows.size)} pages with a string part were read in full (title, work info, categories); ${n(rows.size - [...rows.values()].filter((r: Row & { from?: string }) => !r.from).length)} of them came from the earlier composer harvest.`,
    "- **Originals only.** Only scoring categories without \"(arr)\" count. A page's scorings are parsed through `data/chamber/imslp-instruments.json` (IMSLP name → `InstrumentKey`; the census stops on a name it does not know), the formation is `formationFor()` of `lib/chamber/vocab.ts`, and the smallest in-scope scoring is the work's (others are kept as `alsoScored`, often published alternatives). A violone beside a continuo in trio texture is counted as part of the continuo.",
    "- **Works, not pages.** A page for a whole opus (\"6 String Quartets, Op.18\") counts as the works it holds; a page for an opus or a complete edition whose works also have pages of their own adds nothing.",
    "- **Floor evidence** comes from IMSLP's own categories: \"Pages with commercial recordings\" (mostly Naxos Music Library matches), \"Pages with First Editions\", Hofmeister's Monatsbericht, audio on the page, and \"Works not in public domain\" (recent uploads, mostly by living composers).",
    "",
    "## Headline",
    table(["", "pages", "works"], [
      ["Pages found", found.size, "–"],
      ["… with an original string scoring", pagesWithStringScoring, "–"],
      ["… outside the scope rules", outOfScope.length, "–"],
      ["… in scope (candidates)", candidates.length, total],
      ["Candidates without voice or viol consort", inst.length, sum(inst)],
      ["… IMSLP links a commercial recording", inst.filter((c) => c.recorded).length, recW(inst)],
    ]),
    "",
    `The guess in the plan (2,538 works for 3–9 players from the composer harvest) is replaced by **${n(total)} in-scope works on ${n(candidates.length)} IMSLP pages** by ${n(composerRows.length)} composers. Most will not pass the floor: see the estimate below.`,
    "",
    "## Outside the scope rules",
    `${n(outOfScope.length)} pages have a string part in an original scoring but no scoring that the rules admit (\`out-of-scope.jsonl\`):`,
    "",
    table(["reason", "pages"], Object.entries(census.outOfScopeReasons).filter(([r]) => !r.includes("not in the vocabulary")).map(([r, c]) => [r, c]).concat([["instrument not in the vocabulary (" + notInVocab.map(([r, c]) => `${r.split(":")[0]} ${c}`).join(", ") + ")", notInVocab.reduce((a, [, c]) => a + c, 0)]])),
    "",
    "## By formation",
    table(["formation", "works", "with voice", "viol consort", "recorded (instrumental)"], FORMATIONS.map((f) => {
      const xs = candidates.filter((c) => c.formation === f.key);
      return [f.singular, sum(xs), sum(xs.filter((c) => c.voice)), sum(xs.filter((c) => c.viols)), recW(xs.filter((c) => !c.voice && !c.viols))];
    })),
    "",
    "Viol consorts count as string ensembles by `formationFor()` (four viols are a \"string quartet\"); vocal works with continuo count as \"with continuo\". Both wait for a decision (below).",
    "",
    "## By era",
    "Era is the composer's era in the violin catalogue (or `data/chamber/composers.json`); for the others, IMSLP's piece style and the year.",
    "",
    table(["era", "works", "recorded"], ERA_ORDER.map((e) => [ERA_LABEL[e], sum(candidates.filter((c) => c.era === e)), recW(candidates.filter((c) => c.era === e))])),
    "",
    "Formation × era (works):",
    "",
    table(["formation", ...ERA_ORDER.map((e) => ERA_LABEL[e])], FORMATIONS.map((f) => [f.singular, ...ERA_ORDER.map((e) => formationByEra[f.key][e])])),
    "",
    "By number of players (works): " + Object.entries(census.byPlayers).sort((a, b) => Number(a[0]) - Number(b[0])).map(([p, c]) => `${p}: ${n(c)}`).join(" · ") + ".",
    "",
    "## By composer",
    `${n(composerRows.length)} composers; ${n(census.composers.withOneWork)} have a single work. The top 5 hold ${pct(composerRows.slice(0, 5).reduce((a, r) => a + r.works, 0), total)} of all works, the top 20 ${pct(composerRows.slice(0, 20).reduce((a, r) => a + r.works, 0), total)}, the top 100 ${pct(composerRows.slice(0, 100).reduce((a, r) => a + r.works, 0), total)}.`,
    "",
    table(["composer", "works", "recorded", "published", "main formations"], top.map((r) => [r.composer, r.works, r.recorded, r.published, Object.entries(r.formations).slice(0, 3).map(([f, c]) => `${label(f as FormationKey).toLowerCase()} ${c}`).join(", ")])),
    "",
    "**The swamping risk.** Composers with 80 or more instrumental works of which fewer than a fifth are recorded: " +
      swamp.map((r) => `${r.composer} (${r.works}, ${r.recorded} recorded)`).join(", ") +
      ". Together they hold " + n(swamp.reduce((a, r) => a + r.works, 0)) + " instrumental works. Under the floor most of their works drop out; the ones that stay are `lesser-known` (decision 3), and the default sort must not list them by count. " +
      "The big names are large too, but much of their output is recorded: " +
      big.map((r) => `${r.composer} (${r.works}, ${pct(r.recorded, r.works)} recorded)`).join(", ") +
      ". Even after the floor they will fill the first pages of an unsorted list of their formations.",
    "",
    "## The floor: how many pass",
    `The pool is the ${n(est.pool)} instrumental works (vocal and viol-consort works, pedagogical and fragment flags left out), in tiers by IMSLP's evidence:`,
    "",
    sampleRows
      ? table(["tier", "works", "sample pages", "recorded", "unsure", "modern edition", "recorded share (works)", "estimated pass"], sampleRows.map((t) => [t.tier, t.works, t.checked, t.recorded, t.unsure, t.modernEdition, `${Math.round(t.workShareRecorded * 100)}% (pages ${Math.round(t.pageShareInterval[0] * 100)}–${Math.round(t.pageShareInterval[1] * 100)}%)`, `${n(t.estimatedPass)} (${n(t.estimatedRange[0])}–${n(t.estimatedRange[1])})`]))
      : table(["tier", "works"], TIERS.map((t) => [t, poolTiers[t]])),
    "",
    sampleRows
      ? `**Estimate: about ${n(est.estimatedPass)} public-domain works pass the floor** (range ${n(est.low)}–${n(est.high)}), against ${n(est.recordedSignal)} that carry IMSLP's recording signal. ${census.floor.note}`
      : `Recall-based estimate (no sample yet): about ${n(est.likelyPass)}; upper bound ${n(est.upperBound)}. ${census.floor.note}`,
    "",
    `The recording signal finds ${census.benchmarks.recorded} of the ${census.benchmarks.candidates} benchmarks that are IMSLP candidates (${pct(census.benchmarks.recorded, census.benchmarks.candidates)}), but the benchmarks are standard works; for minor works it finds far fewer, which is what the sample measures.`,
    "",
    "Phase 3 adds the twentieth-century and living composers IMSLP lacks (`data/chamber/curation/groups-modern.json`), so the section's total is this estimate plus phase 3.",
    "",
    "## Benchmarks",
    `${census.benchmarks.imslpPageFound} of the ${census.benchmarks.total} benchmarks have an IMSLP page (through the fact-check's links, following redirects); ${census.benchmarks.harvested} were harvested and ${census.benchmarks.candidates} are candidates. The one harvested but not a candidate is Turina's *La oración del torero*, whose string-quartet version IMSLP files as an arrangement of the lute-quartet original: the composer's own versions listed as arrangements are a gap the census cannot see (the curators' gap check covers them for core composers). The other ${census.benchmarks.total - census.benchmarks.imslpPageFound} are not on IMSLP, most of them under copyright (Barber, Britten, Glass, Pärt …): phase 3. Each benchmark's page is in \`benchmark-matches.json\`.`,
    "",
    "## Open questions for the owner",
    `1. **Vocal works with strings** (${n(open.voice.works)} works, ${n(open.voice.recorded)} recorded): songs with one obbligato instrument (voice, violin, piano), baroque solo and ensemble cantatas with two violins and continuo, Haydn's ${n(sum(candidates.filter((c) => c.composer === "Haydn, Joseph" && c.voice)))} Scottish song settings. The scope admits \"strings with voice\" and the benchmarks hold *Il tramonto*, *Dover Beach* and Schoenberg's Op. 10. Proposal: keep vocal works only with a string quartet or larger ensemble that are programmed as chamber music; leave songs with obbligato and cantatas to a future vocal section.`,
    `2. **Viol consort music** (${n(open.viols.works)} works for 3–6 viols, ${n(open.viols.recorded)} recorded: Jenkins, Lawes, Coprario, Purcell's fantazias …). Viols are string instruments, so the rules admit them, but \`formationFor()\` calls four viols a string quartet. Proposal: in, with a \`formationNote\` (or a new formation \"Viol consort\"), only when recorded.`,
    `3. **Recent uploads** (${n(poolTiers["C not public domain (recent uploads), no recording found"] ?? 0)} works marked \"Works not in public domain\", led by Stephen W. Beatty's ${n(composerRows.find((r) => r.composer === "Beatty, Stephen W.")?.works ?? 0)}): living composers' own uploads, almost never recorded. Proposal: the tail triage drops them unless a recording or a performance by a professional ensemble turns up.`,
    `4. **Instruments the vocabulary lacks**: ${notInVocab.map(([r, c]) => `${r.split(":")[0]} (${c})`).join(", ")}. Only the glass harmonica matters (Mozart's Adagio and Rondo, K. 617); add \`glass-harmonica\` to \`lib/chamber/vocab.ts\`, or list K. 617 with celesta as a published alternative.`,
    "5. **Composer names without a comma.** The violin catalogue spells some names without one (\"Tan Dun\", \"Chen Yi\"); `scripts/chamber/check.ts` requires \"Surname, Given names\" and would reject them. Relax the check for those names, or respell them in both sections.",
    "",
    "## Files",
    "- `census.json`: every number above. `candidates.jsonl`: one line per in-scope page (instruments, formation, scoring, opus, key, year, first publication, minutes, works held, era, signals, flags, genre) for the curators. `out-of-scope.jsonl`: the pages the rules leave out, with the reason. `benchmark-matches.json`. `floor-sample/`: the 120-page sample, its brief and the checkers' results.",
    "- Regenerate: `python3 scripts/chamber/imslp_harvest.py` (resumable; about 2,500 polite API calls, an hour, when the cache is empty) then `npx tsx scripts/chamber/imslp_census.ts`.",
    "",
    "## Known limits",
    "- IMSLP holds public-domain works: almost nothing by composers who died after about 1950–1970, so modern and contemporary works come from phase 3.",
    "- The recording signal is IMSLP's own match to the Naxos Music Library, by title; it misses recordings on labels Naxos does not carry and sometimes matches another work of the same name (the sample measures both).",
    "- \"Works\" is an estimate for collection pages; one-entry sets of short pieces (\"5 Novelettes\") count once, and an opus page with no single-work pages counts the number in its title.",
    "- Pedagogical and fragment flags come from title words and IMSLP categories, and are hints for the curators, not decisions.",
    "",
  ];
  writeFileSync(join(OUT, "CENSUS.md"), lines.join("\n"));
}

console.log(JSON.stringify({ pages: census.pages, works: census.works, floor: census.floor.estimate, benchmarks: census.benchmarks }, null, 1));
if (missingRows.length) console.log(`${missingRows.length} in-scope pages have no full row yet (run the harvest's pages step): ${missingRows.slice(0, 5).join(" · ")}`);
