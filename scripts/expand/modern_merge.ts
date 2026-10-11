/**
 * Modern & contemporary violin works (Oct 2026): consolidates the researchers' files (data/expansion/modern/web/*.json) into catalogue rows.
 * No API calls: levels and Character tags come from the researchers and from independent blind graders (data/expansion/modern/grades/*.json).
 *
 *   npx tsx scripts/expand/modern_merge.ts            # dry run: prints counts, writes review files under data/expansion/modern/final/
 *   npx tsx scripts/expand/modern_merge.ts --write    # also writes data/expansion/modern/final/all-repertoire.next.json, data/imslp-pages.json and the id registry
 *
 * Decisions made by hand live in data/expansion/modern/decisions.json:
 *   { "existing": { "<id>": { "title"?, "level"?, "set"?, "notes"?, "category"?, "accompaniment"?, "minutes"?, "exams"? } },   // corrections to rows already in the catalogue
 *     "drop": { "<author-slug>:<normalised title>": "why" },
 *     "override": { "<author-slug>:<normalised title>": { "title"?, "level"?, "set"?, "category"?, "accompaniment"?, "minutes"?, "notes"?, "well_known"? } },
 *     "author_alias": { "<researcher spelling>": "<catalogue spelling>" },
 *     "author_meta": { "<author>": { "era"?, "dates"?, "nat"?, "gender"? } } }
 * Grader files: {"grader": "...", "grades": [{"key", "level", "mode"?, "pace"?, "character"?: [...], "confidence"?}]}; final level = median(researcher, graders...).
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { HEADER, ROOT, loadRows, read, slug, write } from "./common";

const WRITE = process.argv.includes("--write");
const OUT = "data/expansion/modern/final";
const maybe = <T>(p: string, d: T): T => (existsSync(join(ROOT, p)) ? read<T>(p) : d);

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/ł/g, "l").replace(/ø/g, "o").toLowerCase();
const STOP = new Set(["the", "a", "an", "of", "for", "and", "et", "ou", "or", "de", "la", "le", "les", "du", "des", "no", "nos", "violin", "pour", "per", "fur", "version", "solo", "with", "orchestra", "piano", "unaccompanied"]);
const toks = (t: string) => fold(t).replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w && !STOP.has(w));
const normTitle = (t: string) => toks(t).join(" ");
const jaccard = (a: Set<string>, b: Set<string>) => {
  const i = [...a].filter((x) => b.has(x)).length;
  return i / (a.size + b.size - i || 1);
};
const naturalCmp = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

const CATEGORIES = new Set(["Concerto", "Concert Piece (orch.)", "Virtuoso Showpiece", "Sonata / Duo (vln & pno)", "Suite / Set", "Short Piece", "Solo Violin", "Études & Caprices", "Duet / Double Concerto"]);
const ERAS = new Set(["Baroque", "Classical", "Early Romantic", "Late Romantic", "20th Century", "Contemporary"]);
const ACC = new Set(Object.keys(read<any>("data/accompaniment-map.json")).filter((k) => k !== "_settings"));
const MODES = new Set(["major", "minor", "unsure"]);
const PACES = new Set(["slow", "moderate", "lively"]);
const CHARS = new Set(["lyrical", "dance", "virtuosic", "playful", "dramatic", "folk", "tender", "dark", "heroic", "humorous"]);

interface Work {
  author: string; title: string; category: string; accompaniment?: string; scoring?: string; minutes?: number; year?: string; set?: string;
  level_guess: number; level_basis?: string; notes?: string; well_known?: boolean; edition?: string; source?: string; confidence?: string; recording?: string;
  existing_id?: number | null; slice?: string;
}
interface AuthorInfo { name: string; dates?: string; nationality?: string; gender?: string; era?: string; in_catalogue?: boolean }

// ------------------------------------------------------------------ load
const { rows: existing, values: snapValues } = loadRows();
const col = (n: string) => snapValues[0].indexOf(n);
const existingById = new Map(existing.map((r) => [r.id, r]));
const composerNames = [...new Set(existing.map((r) => r.composer))];
const composerFirstRow = new Map<string, (typeof existing)[number]>();
for (const r of existing) if (!composerFirstRow.has(r.composer)) composerFirstRow.set(r.composer, r);

const dir = "data/expansion/modern/web";
const files = existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".json")) : [];
const works: Work[] = [];
const authors = new Map<string, AuthorInfo>();
const skipped: any[] = [];
const issues: any[] = [];
const checked: any[] = [];
const notes: Record<string, string> = {};
for (const f of files) {
  const j = read<any>(`${dir}/${f}`);
  const g = j.slice ?? f.replace(/\.json$/, "");
  for (const w of j.works ?? []) works.push({ ...w, slice: g });
  for (const a of j.authors ?? []) {
    if (!a?.name) continue;
    const cur = authors.get(a.name);
    if (!cur) authors.set(a.name, { ...a });
    else for (const k of ["dates", "nationality", "gender", "era"] as const) if (!cur[k] && a[k]) cur[k] = a[k];
  }
  for (const s of j.skipped ?? []) skipped.push({ ...s, slice: g });
  for (const i of j.existing_issues ?? []) issues.push({ ...i, slice: g });
  for (const c of j.composers_checked ?? []) checked.push({ ...c, slice: g });
  if (j.note) notes[g] = j.note;
}
console.log(`${files.length} researcher files, ${works.length} works, ${skipped.length} skipped, ${issues.length} existing issues`);

const surnameKey = (n: string) => fold(n.split(",")[0]).replace(/[^a-z]/g, "");
const initialKey = (n: string) => fold((n.split(",")[1] ?? "").trim()).replace(/[^a-z]/g, "").slice(0, 1);
const decisions = maybe<any>("data/expansion/modern/decisions.json", { existing: {}, drop: {}, override: {}, author_alias: {}, author_meta: {} });
const canonicalAuthor = (n: string): string => {
  const name = (decisions.author_alias?.[n.trim()] ?? n).trim();
  if (composerFirstRow.has(name)) return name;
  const same = composerNames.filter((c) => surnameKey(c) === surnameKey(name) && initialKey(c) === initialKey(name));
  return same.length === 1 ? same[0] : name;
};

// ------------------------------------------------------------------ grades
const gradeDir = "data/expansion/modern/grades";
const gradeFiles = existsSync(join(ROOT, gradeDir)) ? readdirSync(join(ROOT, gradeDir)).filter((f) => f.endsWith(".json")) : [];
const grades = new Map<string, { level: number; mode?: string; pace?: string; character?: string[] }[]>();
for (const f of gradeFiles) {
  for (const g of read<any>(`${gradeDir}/${f}`).grades ?? []) {
    const arr = grades.get(g.key) ?? [];
    arr.push({ level: Number(g.level), mode: g.mode, pace: g.pace, character: g.character });
    grades.set(g.key, arr);
  }
}
const levelTable = read<any>("data/source/levels.json").levels as { level: number; name: string; exam: string }[];
const guide = (lv: number) => {
  const l = levelTable.find((x) => x.level === lv);
  return l ? `${l.name} (${l.exam})` : "";
};
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)] ?? 0;
};
const mostCommon = (xs: (string | undefined)[], ok: Set<string>) => {
  const c = new Map<string, number>();
  for (const x of xs) if (x && ok.has(x)) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
};

// ------------------------------------------------------------------ consolidate
const confRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
const byKey = new Map<string, Work & { slices: string[]; sources: string[] }>();
const dupLog: string[] = [];
for (const w of works) {
  if (!w.title || !w.author) continue;
  const author = canonicalAuthor(w.author);
  const key = `${slug(author)}:${normTitle(w.title)}`;
  const cur = byKey.get(key);
  if (!cur) {
    byKey.set(key, { ...w, author, slices: [w.slice!], sources: w.source ? [w.source] : [] });
    continue;
  }
  dupLog.push(`${key}: ${cur.slices.join("+")} + ${w.slice}`);
  cur.slices.push(w.slice!);
  if (w.source && !cur.sources.includes(w.source)) cur.sources.push(w.source);
  if ((confRank[w.confidence ?? ""] ?? 0) > (confRank[cur.confidence ?? ""] ?? 0)) Object.assign(cur, { ...w, author, slices: cur.slices, sources: cur.sources });
  else cur.well_known = cur.well_known || w.well_known;
}
console.log(`${byKey.size} distinct works after merging ${dupLog.length} duplicates between researchers`);

// ------------------------------------------------------------------ match against the catalogue
const exByAuthor = new Map<string, { id: number; title: string; norm: string; words: Set<string> }[]>();
for (const r of existing) {
  const list = exByAuthor.get(r.composer) ?? [];
  list.push({ id: r.id, title: r.title, norm: normTitle(r.title), words: new Set(toks(r.title)) });
  exByAuthor.set(r.composer, list);
}
const matches: { key: string; title: string; id: number; why: string }[] = [];
const doubts: string[] = [];
const fresh: (Work & { slices: string[]; sources: string[]; key: string })[] = [];
for (const [key, w] of [...byKey.entries()].sort((a, b) => naturalCmp(a[0], b[0]))) {
  if (decisions.drop?.[key]) {
    skipped.push({ title: w.title, author: w.author, reason: `decision: ${decisions.drop[key]}`, slice: w.slices.join("+") });
    continue;
  }
  const ov = decisions.override?.[key];
  if (ov) {
    const { level, ...rest } = ov;
    Object.assign(w, rest);
    if (level != null) w.level_guess = Number(level);
  }
  if (w.existing_id && existingById.has(Number(w.existing_id))) {
    matches.push({ key, title: w.title, id: Number(w.existing_id), why: "researcher gave existing_id" });
    continue;
  }
  const mine = exByAuthor.get(w.author) ?? [];
  const exact = mine.find((m) => m.norm === normTitle(w.title));
  if (exact) {
    matches.push({ key, title: w.title, id: exact.id, why: "same normalised title" });
    continue;
  }
  const ws = new Set(toks(w.title));
  const near = mine.map((m) => ({ m, j: jaccard(ws, m.words) })).filter((x) => x.j >= 0.6).sort((a, b) => b.j - a.j)[0];
  if (near) doubts.push(`${w.author} | ${w.title}  ~  id ${near.m.id} ${near.m.title} (${near.j.toFixed(2)})   [${key}]`);
  fresh.push({ ...w, key });
}
console.log(`${matches.length} already in the catalogue, ${doubts.length} near-matches to review, ${fresh.length} new`);

// ------------------------------------------------------------------ build rows
const registry: Record<string, number> = maybe("data/expansion/id-registry.json", {});
let nextId = Math.max(...existing.map((r) => r.id), ...Object.values(registry)) + 1;
const problems: string[] = [];
const eraFromDates = (dates: string) => {
  const m = dates.match(/(\d{4})/);
  if (!m) return "";
  const y = Number(m[1]);
  return y < 1700 ? "Baroque" : y < 1770 ? "Classical" : y < 1815 ? "Early Romantic" : y < 1860 ? "Late Romantic" : y < 1950 ? "20th Century" : "Contemporary";
};
const metaFor = (author: string) => {
  const ex = composerFirstRow.get(author);
  if (ex) return { era: ex.era, dates: ex.dates, nat: ex.nat, gender: ex.gender };
  const a = [...authors.values()].find((x) => canonicalAuthor(x.name) === author);
  if (!a) return null;
  const m = {
    era: a.era && ERAS.has(a.era) ? a.era : eraFromDates(a.dates ?? ""),
    dates: a.dates ?? "", nat: a.nationality ?? "", gender: a.gender === "Female" ? "Female" : a.gender === "Male" ? "Male" : "",
  };
  return { ...m, ...(decisions.author_meta?.[author] ?? {}) };
};
const pagesOut: Record<string, string> = { ...maybe<Record<string, string>>("data/imslp-pages.json", {}) };
const rows: string[][] = [];
const added: any[] = [];
for (const w of fresh) {
  const c = HEADER.indexOf.bind(HEADER);
  const meta = metaFor(w.author);
  if (!meta || !meta.era) { problems.push(`no author metadata/era for ${w.author} (${w.title})`); continue; }
  if (!CATEGORIES.has(w.category)) { problems.push(`bad category ${w.category}: ${w.title}`); continue; }
  const gs = grades.get(w.key) ?? [];
  const lv = gs.length ? median([w.level_guess, ...gs.map((g) => g.level).filter((x) => x >= 1)]) : w.level_guess;
  if (!(lv >= 1 && lv <= 10)) { problems.push(`bad level ${lv}: ${w.title}`); continue; }
  const acc = w.accompaniment && ACC.has(w.accompaniment) ? w.accompaniment : "";
  if (!acc) { problems.push(`accompaniment "${w.accompaniment}" unknown: ${w.title}`); continue; }
  const mode = mostCommon(gs.map((g) => g.mode), new Set(["major", "minor"])); // "unsure" is not written to the sheet (the build reads only major/minor)
  const pace = mostCommon(gs.map((g) => g.pace), PACES);
  const chars = [...new Set(gs.flatMap((g) => g.character ?? []).filter((x) => CHARS.has(x)))].slice(0, 3);
  const rkey = `modern:${w.key}`;
  const id = registry[rkey] ?? (registry[rkey] = nextId++);
  const r = new Array(HEADER.length).fill("");
  r[c("Composer")] = w.author;
  r[c("Title")] = w.title.trim();
  r[c("Level (1–10)")] = String(lv);
  r[c("Level guide")] = guide(lv);
  r[c("Category")] = w.category;
  r[c("Accompaniment")] = acc;
  r[c("Era")] = meta.era;
  r[c("Dates")] = meta.dates;
  r[c("Nationality")] = meta.nat;
  r[c("Composer gender")] = meta.gender;
  r[c("Approx. min")] = w.minutes ? String(w.minutes) : "";
  r[c("Notes / teaching focus")] = (w.notes ?? "").trim();
  r[c("Listen")] = "▶ Listen";
  r[c("ID")] = String(id);
  r[c("Set")] = (w.set ?? "").trim();
  r[c("Character")] = mode || pace || chars.length ? [mode, pace, ...chars].filter(Boolean).join(", ") : "";
  r[c("Popularity")] = w.well_known ? "Well-known" : "Lesser-known";
  const im = (w.sources ?? []).map((s) => s.match(/imslp\.org\/wiki\/([^?#]+)/)?.[1]).find(Boolean);
  if (im && !im.startsWith("Category:")) { r[c("Score")] = "IMSLP"; pagesOut[String(id)] = decodeURIComponent(im).replace(/_/g, " "); }
  rows.push(r);
  added.push({ id, key: w.key, author: w.author, title: w.title, category: w.category, level: lv, level_guess: w.level_guess, graded: gs.map((g) => g.level), set: w.set ?? "", slices: w.slices, confidence: w.confidence, sources: w.sources, minutes: w.minutes ?? 0, year: w.year ?? "" });
}
for (const w of fresh) if (!added.some((a) => a.key === w.key)) problems.push(`not added (see above): ${w.author} | ${w.title}`);
rows.sort((a, b) => naturalCmp(a[0], b[0]) || naturalCmp(a[HEADER.indexOf("Category")], b[HEADER.indexOf("Category")]) || naturalCmp(a[1], b[1]));

// ------------------------------------------------------------------ corrections to existing rows
const edited = snapValues.map((r) => [...r]);
const changes: any[] = [];
for (const [sid, d] of Object.entries<any>(decisions.existing ?? {})) {
  const idx = edited.findIndex((r, i) => i > 0 && String(r[col("ID")]) === sid);
  if (idx < 0) { problems.push(`decision for unknown id ${sid}`); continue; }
  const map: Record<string, string> = { title: "Title", level: "Level (1–10)", set: "Set", notes: "Notes / teaching focus", category: "Category", accompaniment: "Accompaniment", exams: "Exam & syllabus lists", minutes: "Approx. min", composer: "Composer" };
  for (const [k, v] of Object.entries(d)) {
    const cI = col(map[k]);
    if (cI < 0) { problems.push(`unknown field ${k} in decision ${sid}`); continue; }
    const before = edited[idx][cI] ?? "";
    if (String(before) !== String(v)) {
      changes.push({ id: Number(sid), composer: edited[idx][0], title: edited[idx][1], field: k, before, after: v });
      edited[idx][cI] = String(v);
      if (k === "level") edited[idx][col("Level guide")] = guide(Number(v));
    }
  }
}

// ------------------------------------------------------------------ outputs
write(`${OUT}/added.json`, added);
write(`${OUT}/matches.json`, matches);
write(`${OUT}/near-matches.txt`, doubts.join("\n") + "\n");
write(`${OUT}/skipped.json`, skipped);
write(`${OUT}/existing-issues.json`, issues.filter((i) => !decisions.existing?.[String(i.id)]));
write(`${OUT}/composers-checked.json`, checked);
write(`${OUT}/changes.json`, changes);
write(`${OUT}/problems.txt`, problems.join("\n") + "\n");
{
  // blind grading input: no researcher levels; anchors from the catalogue; the same file asks the graders for mode / pace / character
  const anchorComposers = new Set(["Pärt, Arvo", "Glass, Philip", "Adams, John", "Corigliano, John", "Bartók, Béla", "Shostakovich, Dmitri", "Prokofiev, Sergei", "Sciarrino, Salvatore", "Gubaidulina, Sofia", "Ligeti, György", "Saariaho, Kaija", "Kurtág, György", "Schnittke, Alfred", "Brahms, Johannes", "Sibelius, Jean", "Paganini, Niccolò", "Ysaÿe, Eugène", "Barber, Samuel", "Britten, Benjamin", "Walton, William"]);
  const anchors = existing.filter((r) => anchorComposers.has(r.composer) && ["Concerto", "Solo Violin", "Sonata / Duo (vln & pno)", "Concert Piece (orch.)", "Short Piece", "Suite / Set", "Duet / Double Concerto"].includes(r.category))
    .map((r) => ({ composer: r.composer, title: r.title, category: r.category, accompaniment: r.acc, level: r.level }));
  const items = added.map((a) => {
    const w = fresh.find((x) => x.key === a.key)!;
    return { key: a.key, author: a.author, title: a.title, category: a.category, accompaniment: w.accompaniment, scoring: w.scoring ?? "", year: a.year, minutes: a.minutes, set: a.set, notes: w.notes ?? "", level_basis: "" };
  });
  write("data/expansion/modern/to-grade.json", { levels: levelTable, vocabulary: { mode: [...MODES], pace: [...PACES], character: [...CHARS] }, anchors, items });
}
console.log(`rows to add ${rows.length}; corrections applied to existing rows ${changes.length}; existing issues without a decision ${issues.filter((i) => !decisions.existing?.[String(i.id)]).length}; problems ${problems.length}`);
if (problems.length) console.log(problems.slice(0, 20).join("\n"));
const perAuthor = new Map<string, number>();
for (const r of rows) perAuthor.set(r[0], (perAuthor.get(r[0]) ?? 0) + 1);
console.log([...perAuthor.entries()].sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a.split(",")[0]} ${n}`).join(", "));
if (WRITE) {
  write(`${OUT}/all-repertoire.next.json`, { range: "", values: [...edited, ...rows] });
  write("data/imslp-pages.json", pagesOut);
  write("data/expansion/id-registry.json", registry);
  console.log(`wrote ${OUT}/all-repertoire.next.json (${edited.length - 1} + ${rows.length} rows)`);
}
