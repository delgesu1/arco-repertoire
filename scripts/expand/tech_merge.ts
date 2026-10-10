/**
 * Technical-materials expansion (Oct 2026): consolidates the researchers' files (data/expansion/tech/web/*.json) into catalogue rows.
 * No API calls: levels come from the researchers and from independent graders' files (data/expansion/tech/grades/*.json).
 *
 *   npx tsx scripts/expand/tech_merge.ts            # dry run: prints counts, writes review files under data/expansion/tech/final/
 *   npx tsx scripts/expand/tech_merge.ts --preview  # dry run + final/all-repertoire.preview.json (for SNAPSHOT=… PREVIEW=1 scripts/build-data.ts); ids not saved
 *   npx tsx scripts/expand/tech_merge.ts --write    # also writes the next snapshot (data/expansion/tech/final/all-repertoire.next.json),
 *                                                    data/imslp-pages.json additions and the id registry
 *
 * Decisions made by hand live in data/expansion/tech/decisions.json:
 *   { "existing": { "<id>": { "title"?, "level"?, "set"?, "notes"?, "category"?, "accompaniment"?, "exams"? } },   // corrections to rows already in the catalogue
 *     "drop": { "<author-slug>:<normalised title>": "why" },                                                         // researcher entries to leave out
 *     "override": { "<author-slug>:<normalised title>": { "title"?, "level"?, "set"?, "category"?, "notes"?, "well_known"? } },
 *     "author_alias": { "<researcher spelling>": "<catalogue spelling>" },                                           // same person spelled differently
 *     "author_meta": { "<author>": { "era"?, "dates"?, "nat"?, "gender"? } },                                         // when the researchers could not say
 *     "imslp_pages": { "<existing id>": "<IMSLP page title>" } }                                                     // score links for existing rows
 * Grader files (data/expansion/tech/grades/*.json) give levels 1-10, or 0 = below the catalogue floor (a row is left out when both graders say 0, or one says 0 and the researcher and the other grader say 1).
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { HEADER, ROOT, loadRows, read, slug, write } from "./common";

const WRITE = process.argv.includes("--write");
const PREVIEW = process.argv.includes("--preview"); // writes final/all-repertoire.preview.json only: no registry, no imslp-pages (ids are not made sticky)
const OUT = "data/expansion/tech/final";
const maybe = <T>(p: string, d: T): T => (existsSync(join(ROOT, p)) ? read<T>(p) : d);

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/ł/g, "l").replace(/ø/g, "o").toLowerCase();
const STOP = new Set(["the", "a", "an", "of", "for", "and", "et", "ou", "or", "de", "la", "le", "les", "du", "des", "book", "bk", "part", "vol", "volume", "op", "no", "nos", "violin", "pour", "per", "fur", "for"]);
const toks = (t: string) => fold(t).replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w && !STOP.has(w));
const normTitle = (t: string) => toks(t).join(" ");
const jaccard = (a: Set<string>, b: Set<string>) => {
  const i = [...a].filter((x) => b.has(x)).length;
  return i / (a.size + b.size - i || 1);
};
const naturalCmp = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

const CATEGORIES = new Set(["Technique & Scales", "Études & Caprices"]);
const ERAS = new Set(["Baroque", "Classical", "Early Romantic", "Late Romantic", "20th Century", "Contemporary"]);
const ACC = new Set(["Unaccompanied", "2 violins", "Piano", "Second violin", "Piano or orchestra", "Second violin & piano", "2 violins & piano", "Orchestra (piano reduction)"]);

interface Work {
  author: string;
  title: string;
  category: string;
  accompaniment?: string;
  set?: string;
  level_guess: number;
  level_basis?: string;
  contents?: string;
  notes?: string;
  well_known?: boolean;
  tradition?: string;
  edition?: string;
  imslp_page?: string;
  source?: string;
  confidence?: string;
  existing_id?: number | null;
  exams?: string;
  number?: number;
  group?: string;
}
interface AuthorInfo { name: string; dates?: string; nationality?: string; gender?: string; era?: string; tradition?: string; in_catalogue?: boolean }

// ------------------------------------------------------------------ load
const { rows: existing, values: snapValues } = loadRows();
const header = snapValues[0];
const col = (n: string) => header.indexOf(n);
const existingById = new Map(existing.map((r) => [r.id, r]));
const composerNames = [...new Set(existing.map((r) => r.composer))];
const composerFirstRow = new Map<string, (typeof existing)[number]>();
for (const r of existing) if (!composerFirstRow.has(r.composer)) composerFirstRow.set(r.composer, r);

const dir = "data/expansion/tech/web";
const files = existsSync(join(ROOT, dir)) ? readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".json")) : [];
const works: Work[] = [];
const authors = new Map<string, AuthorInfo>();
const skipped: any[] = [];
const issues: any[] = [];
const newAuthorsFound: string[] = [];
const notes: Record<string, string> = {};
for (const f of files) {
  const j = read<any>(`${dir}/${f}`);
  const g = j.group ?? f.replace(/\.json$/, "");
  for (const w of j.works ?? []) works.push({ ...w, group: g });
  for (const a of j.authors ?? []) {
    if (!a?.name) continue;
    const cur = authors.get(a.name);
    if (!cur) authors.set(a.name, { ...a });
    else for (const k of ["dates", "nationality", "gender", "era", "tradition"] as const) if (!cur[k] && a[k]) cur[k] = a[k]; // fill blanks from other researchers
  }
  for (const s of j.skipped ?? []) skipped.push({ ...s, group: g });
  for (const i of j.existing_issues ?? []) issues.push({ ...i, group: g });
  for (const n of j.new_authors_found ?? []) newAuthorsFound.push(`${g}: ${n}`);
  if (j.note) notes[g] = j.note;
}
console.log(`${files.length} researcher files, ${works.length} works, ${skipped.length} skipped, ${issues.length} existing issues`);

// ------------------------------------------------------------------ author names -> catalogue spelling
const surnameKey = (n: string) => fold(n.split(",")[0]).replace(/[^a-z]/g, "");
const initialKey = (n: string) => fold((n.split(",")[1] ?? "").trim()).replace(/[^a-z]/g, "").slice(0, 1);
const decisions = maybe<any>("data/expansion/tech/decisions.json", { existing: {}, drop: {}, override: {}, author_alias: {}, imslp_pages: {} });
const canonicalAuthor = (n: string): string => {
  const name = (decisions.author_alias?.[n.trim()] ?? n).trim();
  if (composerFirstRow.has(name)) return name;
  const same = composerNames.filter((c) => surnameKey(c) === surnameKey(name) && initialKey(c) === initialKey(name));
  return same.length === 1 ? same[0] : name;
};

// ------------------------------------------------------------------ decisions, grades
const gradeFiles = existsSync(join(ROOT, "data/expansion/tech/grades")) ? readdirSync(join(ROOT, "data/expansion/tech/grades")).filter((f) => f.endsWith(".json")) : [];
const grades = new Map<string, number[]>();
for (const f of gradeFiles) {
  const j = read<any>(`data/expansion/tech/grades/${f}`);
  for (const g of j.grades ?? []) {
    const arr = grades.get(g.key) ?? [];
    arr.push(Number(g.level));
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
  return s[Math.floor((s.length - 1) / 2) + (s.length % 2 === 0 ? 0 : 0)] ?? 0;
};

// ------------------------------------------------------------------ consolidate
const confRank: Record<string, number> = { high: 3, medium: 2, low: 1 };
const byKey = new Map<string, Work & { groups: string[]; sources: string[] }>();
const dupLog: string[] = [];
for (const w of works) {
  if (!w.title || !w.author) continue;
  const author = canonicalAuthor(w.author);
  const key = `${slug(author)}:${normTitle(w.title)}`;
  const cur = byKey.get(key);
  if (!cur) {
    byKey.set(key, { ...w, author, groups: [w.group!], sources: w.source ? [w.source] : [] });
    continue;
  }
  dupLog.push(`${key}: ${cur.groups.join("+")} + ${w.group}`);
  cur.groups.push(w.group!);
  if (w.source && !cur.sources.includes(w.source)) cur.sources.push(w.source);
  if ((confRank[w.confidence ?? ""] ?? 0) > (confRank[cur.confidence ?? ""] ?? 0)) Object.assign(cur, { ...w, author, groups: cur.groups, sources: cur.sources });
  else {
    for (const f of ["imslp_page", "notes", "contents", "exams", "edition", "set"] as const) if (!cur[f] && w[f]) (cur as any)[f] = w[f];
    cur.well_known = cur.well_known || w.well_known;
  }
}
console.log(`${byKey.size} distinct works after merging ${dupLog.length} duplicates between researchers`);

// ------------------------------------------------------------------ match against the catalogue
const exByAuthor = new Map<string, { id: number; title: string; norm: string; words: Set<string>; row: (typeof existing)[number] }[]>();
for (const r of existing) {
  const list = exByAuthor.get(r.composer) ?? [];
  list.push({ id: r.id, title: r.title, norm: normTitle(r.title), words: new Set(toks(r.title)), row: r });
  exByAuthor.set(r.composer, list);
}
const matches: { key: string; title: string; id: number; why: string }[] = [];
const doubts: string[] = [];
const fresh: (Work & { groups: string[]; sources: string[]; key: string })[] = [];
for (const [key, w] of [...byKey.entries()].sort((a, b) => naturalCmp(a[0], b[0]))) {
  if (decisions.drop?.[key]) {
    skipped.push({ title: w.title, author: w.author, reason: `decision: ${decisions.drop[key]}`, group: w.groups.join("+") });
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
  const nt = normTitle(w.title);
  const exact = mine.find((m) => m.norm === nt);
  if (exact) {
    matches.push({ key, title: w.title, id: exact.id, why: "same normalised title" });
    continue;
  }
  const ws = new Set(toks(w.title));
  const near = mine.map((m) => ({ m, j: jaccard(ws, m.words) })).filter((x) => x.j >= 0.7).sort((a, b) => b.j - a.j)[0];
  if (near) {
    doubts.push(`${w.author} | ${w.title}  ~  id ${near.m.id} ${near.m.title} (${near.j.toFixed(2)})`);
  }
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
  let era = a.era && ERAS.has(a.era) ? a.era : eraFromDates(a.dates ?? "");
  if (!era) {
    // no life dates known: estimate the generation from the earliest publication year in the editions (born about 35 years earlier)
    const years = works.filter((x) => canonicalAuthor(x.author) === author).flatMap((x) => [...(x.edition ?? "").replace(/https?:\/\/\S+/g, "").replace(/\b(?:No|Nr|plate|pl|HN|EP|U\.?E|Op|Opp|ISBN|BnF)\.?\s*[\w.-]*\d+/gi, "").matchAll(/\b(1[5-9]\d\d|20[0-2]\d)\b/g)].map((m) => Number(m[1])));
    if (years.length) {
      era = eraFromDates(String(Math.min(...years) - 35));
      problems.push(`era "${era}" estimated from the first publication year for ${author} (no life dates found)`);
    }
  }
  const m = { era, dates: a.dates ?? "", nat: a.nationality ?? "", gender: a.gender === "Female" ? "Female" : a.gender === "Male" ? "Male" : "" };
  return { ...m, ...(decisions.author_meta?.[author] ?? {}) };
};
const pagesIn = maybe<Record<string, string>>("data/imslp-pages.json", {});
const pagesOut: Record<string, string> = { ...pagesIn, ...(decisions.imslp_pages ?? {}) };
const rows: string[][] = [];
const added: any[] = [];
for (const w of fresh) {
  const c = HEADER.indexOf.bind(HEADER);
  const meta = metaFor(w.author);
  if (!meta) { problems.push(`no author metadata for ${w.author} (${w.title})`); continue; }
  if (!CATEGORIES.has(w.category)) { problems.push(`bad category ${w.category}: ${w.title}`); continue; }
  const gRaw = grades.get(w.key) ?? [];
  // below the floor: two graders say 0, or one says 0 and everybody else puts it at level 1 (the lowest the catalogue has)
  const zeros = gRaw.filter((x) => x === 0).length;
  if (zeros >= 2 || (zeros >= 1 && [w.level_guess, ...gRaw].every((x) => x <= 1))) {
    skipped.push({ title: w.title, author: w.author, reason: "graders: below the catalogue floor", group: w.groups.join("+") });
    continue;
  }
  const g = gRaw.map((x) => (x === 0 ? 1 : x));
  const lv = g.length ? median([w.level_guess, ...g]) : w.level_guess;
  if (!(lv >= 1 && lv <= 10)) { problems.push(`bad level ${lv}: ${w.title}`); continue; }
  const acc = w.accompaniment && ACC.has(w.accompaniment) ? w.accompaniment : "Unaccompanied";
  if (w.accompaniment && !ACC.has(w.accompaniment)) problems.push(`accompaniment "${w.accompaniment}" mapped to Unaccompanied: ${w.title}`);
  const rkey = `tech:${w.key}`;
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
  r[c("Notes / teaching focus")] = (w.notes ?? "").trim();
  r[c("Exam & syllabus lists")] = (w.exams ?? "").trim();
  r[c("Listen")] = "▶ Listen";
  r[c("Score")] = w.imslp_page ? "IMSLP" : "";
  r[c("ID")] = String(id);
  r[c("Set")] = (w.set ?? "").trim();
  r[c("Character")] = "";
  r[c("Popularity")] = w.well_known ? "Well-known" : "Lesser-known";
  if (w.imslp_page) pagesOut[String(id)] = w.imslp_page;
  rows.push(r);
  added.push({ id, key: w.key, author: w.author, title: w.title, category: w.category, level: lv, level_guess: w.level_guess, graded: g, set: w.set ?? "", groups: w.groups, confidence: w.confidence, sources: w.sources, imslp_page: w.imslp_page ?? "", number: w.number ?? null });
}
for (const w of fresh) if (!added.some((a) => a.key === w.key)) problems.push(`not added (see above): ${w.author} | ${w.title}`);
rows.sort((a, b) => naturalCmp(a[0], b[0]) || naturalCmp(a[HEADER.indexOf("Category")], b[HEADER.indexOf("Category")]) || naturalCmp(a[HEADER.indexOf("Set")], b[HEADER.indexOf("Set")]) || naturalCmp(a[1], b[1]));

// ------------------------------------------------------------------ corrections to existing rows
const edited = existing.length ? snapValues.map((r) => [...r]) : snapValues;
const changes: any[] = [];
for (const [sid, d] of Object.entries<any>(decisions.existing ?? {})) {
  const idx = edited.findIndex((r, i) => i > 0 && String(r[col("ID")]) === sid);
  if (idx < 0) { problems.push(`decision for unknown id ${sid}`); continue; }
  const map: Record<string, string> = { title: "Title", level: "Level (1–10)", set: "Set", notes: "Notes / teaching focus", category: "Category", accompaniment: "Accompaniment", exams: "Exam & syllabus lists" };
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
const issuesOpen = issues.filter((i) => !decisions.existing?.[String(i.id)]);
write(`${OUT}/added.json`, added);
write(`${OUT}/matches.json`, matches);
write(`${OUT}/near-matches.txt`, doubts.join("\n") + "\n");
write(`${OUT}/skipped.json`, skipped);
write(`${OUT}/existing-issues.json`, issues);
write(`${OUT}/duplicates-between-researchers.txt`, dupLog.join("\n") + "\n");
write(`${OUT}/new-authors-found.txt`, newAuthorsFound.join("\n") + "\n");
write(`${OUT}/changes.json`, changes);
write(`${OUT}/problems.txt`, problems.join("\n") + "\n");
{
  // blind grading input: no researcher levels, with anchors from the catalogue and (for individual studies) the level of the whole book
  const anchors = existing
    .filter((r) => r.category === "Technique & Scales" || r.category === "Études & Caprices")
    .filter((r) => r.composer !== "Paganini, Niccolò")
    .map((r) => ({ author: r.composer, title: r.title, category: r.category, level: r.level, set: r.set }));
  const bookLevel = (author: string, set: string) => {
    if (!set) return null;
    const ns = normTitle(set);
    const hit = (exByAuthor.get(author) ?? []).find((m) => m.norm === ns || m.norm.startsWith(ns) || ns.startsWith(m.norm));
    return hit ? { title: hit.title, level: hit.row.level } : null;
  };
  const items = fresh
    .filter((w) => added.some((a) => a.title === w.title && a.author === w.author))
    .map((w) => ({ key: w.key, author: w.author, title: w.title, category: w.category, set: w.set ?? "", number: w.number ?? null, contents: w.contents ?? "", notes: w.notes ?? "", whole_book: bookLevel(w.author, w.set ?? "") }));
  write("data/expansion/tech/to-grade.json", { levels: read<any>("data/source/levels.json").levels, anchors, items });
}
console.log(`rows to add ${rows.length}; corrections applied to existing rows ${changes.length}; existing issues reported ${issues.length} (${issuesOpen.length} without a decision); problems ${problems.length}`);
if (problems.length) console.log(problems.slice(0, 15).join("\n"));
const perAuthor = new Map<string, number>();
for (const r of rows) perAuthor.set(r[0], (perAuthor.get(r[0]) ?? 0) + 1);
console.log([...perAuthor.entries()].sort((a, b) => b[1] - a[1]).map(([a, n]) => `${a.split(",")[0]} ${n}`).join(", "));

if (PREVIEW && !WRITE) {
  write(`${OUT}/all-repertoire.preview.json`, { range: "", values: [...edited, ...rows] });
  console.log(`wrote ${OUT}/all-repertoire.preview.json (${edited.length - 1} + ${rows.length} rows; preview only, ids not saved)`);
}
if (WRITE) {
  const next = { range: "", values: [...edited, ...rows] };
  write(`${OUT}/all-repertoire.next.json`, next);
  write("data/imslp-pages.json", pagesOut);
  write("data/expansion/id-registry.json", registry);
  console.log(`wrote ${OUT}/all-repertoire.next.json (${edited.length - 1} + ${rows.length} rows)`);
}
