/**
 * Turns the Sheet snapshot into the site's catalogue.
 *
 *   data/source/all-repertoire.json   Sheets get_values dump of 'All Repertoire'!A1:U
 *   data/source/levels.json           level names / exam equivalents (Start Here)
 *   data/accompaniment-map.json       raw accompaniment text -> setting keys (build fails on unknown values)
 *   data/recordings.json              optional: matched YouTube recordings by piece id
 *
 * Writes data/build/catalogue.json (server) and public/data/catalogue.json (client).
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { Catalogue, Piece, Recording, SettingKey } from "../lib/types";
import { CHARACTER, ERAS, TYPES } from "../lib/vocab";

const ROOT = join(__dirname, "..");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

// SNAPSHOT=<path> builds from another snapshot; PREVIEW=1 then writes only data/expansion/preview/catalogue.json and leaves
// the files the site serves (data/build, public/data, lib/advisor/catalogue-text.ts) alone
const SNAPSHOT = process.env.SNAPSHOT ?? "data/source/all-repertoire.json";
const PREVIEW = process.env.PREVIEW === "1";
const sheet: string[][] = read(SNAPSHOT).values;
const levels = read("data/source/levels.json");
const accMap: Record<string, SettingKey[]> = read("data/accompaniment-map.json");
interface Judged {
  confidence: "high" | "medium" | "low" | "none";
  video: { id: string; title: string; channel: string; seconds: number | null; views: number | null } | null;
  alternates: string[];
  maxViews: number;
}
const judged: Record<string, Judged> = existsSync(join(ROOT, "data/recordings-judged.json"))
  ? read("data/recordings-judged.json")
  : {};
const ACCEPT = new Set((process.env.RECORDING_CONFIDENCE ?? "high,medium").split(","));
const tagFile: Record<string, { mode: string; pace: string; character: string[]; popularity: string }> = existsSync(
  join(ROOT, "data/tags.json"),
)
  ? read("data/tags.json")
  : {};

// second opinion on popularity from Opus (scripts/popularity.ts)
const popOpus: Record<string, string> = existsSync(join(ROOT, "data/popularity-opus.json")) ? read("data/popularity-opus.json") : {};

// exact IMSLP work pages by piece id (data/imslp-pages.json), found while expanding the catalogue
const imslpPages: Record<string, string> = existsSync(join(ROOT, "data/imslp-pages.json")) ? read("data/imslp-pages.json") : {};

const header = sheet[0];
const col = (name: string) => {
  const i = header.indexOf(name);
  if (i < 0) throw new Error(`Missing column "${name}" in sheet snapshot`);
  return i;
};
const C = {
  composer: col("Composer"),
  title: col("Title"),
  level: col("Level (1–10)"),
  category: col("Category"),
  acc: col("Accompaniment"),
  era: col("Era"),
  dates: col("Dates"),
  nat: col("Nationality"),
  gender: col("Composer gender"),
  min: col("Approx. min"),
  notes: col("Notes / teaching focus"),
  exams: col("Exam & syllabus lists"),
  score: col("Score"),
  id: col("ID"),
  set: col("Set"),
  character: col("Character"),
  popularity: col("Popularity"),
  override: col("Recording override"),
};

export const fold = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/ł/g, "l").replace(/ø/g, "o");
const slugify = (s: string, max = 80) =>
  fold(s)
    .toLowerCase()
    .replace(/['’"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, max)
    .replace(/-$/, "");

const firstLast = (name: string) => {
  const i = name.indexOf(", ");
  return i < 0 ? name : `${name.slice(i + 2)} ${name.slice(0, i)}`;
};
const surname = (name: string) => name.split(", ")[0];

const BOARD_RX: [RegExp, string][] = [
  [/\bABRSM\b/, "ABRSM"],
  [/\bTrinity\b/, "Trinity"],
  [/\bRCM\b/, "RCM"],
  [/\bAMEB\b/, "AMEB"],
  [/\bASTA\b/, "ASTA"],
  [/\bNYSSMA\b/, "NYSSMA"],
  [/\bUIL\b/, "UIL"],
  [/\bHenle\b/, "Henle"],
];

const youtubeId = (url: string) => {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
};

const errors: string[] = [];
const warn = (m: string) => errors.push(m);

const pieces: Piece[] = [];
const seenIds = new Set<number>();

for (const [n, r] of sheet.slice(1).entries()) {
  const g = (i: number) => (r[i] ?? "").toString().trim();
  const row = n + 2;
  const id = Number(g(C.id));
  if (!Number.isInteger(id) || id <= 0) warn(`row ${row}: missing/invalid ID "${g(C.id)}"`);
  if (seenIds.has(id)) warn(`row ${row}: duplicate ID ${id}`);
  seenIds.add(id);

  const composer = g(C.composer);
  const title = g(C.title);
  const level = Number(g(C.level));
  const type = TYPES.find((t) => t.sheet === g(C.category))?.key;
  if (!type) warn(`row ${row}: unknown category "${g(C.category)}"`);
  const era = ERAS.find((e) => e.sheet === g(C.era))?.key;
  if (!era) warn(`row ${row}: unknown era "${g(C.era)}"`);
  const accompaniment = g(C.acc);
  const settings = accMap[accompaniment];
  if (!settings) warn(`row ${row}: accompaniment "${accompaniment}" is not in data/accompaniment-map.json`);

  const minutes = g(C.min) ? Number(g(C.min)) : null;
  const exams = g(C.exams);
  const examBoards = BOARD_RX.filter(([rx]) => rx.test(exams)).map(([, b]) => b);

  const keyMatch = title.match(/\bin [A-G](?:-flat|-sharp)? (major|minor)\b/);
  let mode: Piece["mode"] = keyMatch ? (keyMatch[1] as "major" | "minor") : null;
  let pace: Piece["pace"] = null;
  const character: string[] = [];
  for (const raw of g(C.character).toLowerCase().split(/[,·;]/)) {
    const t = raw.trim();
    if (!t) continue;
    if (t === "major" || t === "minor") mode = mode ?? t;
    else if (t === "slow" || t === "moderate" || t === "lively") pace = t;
    else if ((CHARACTER as readonly string[]).includes(t)) character.push(t);
    else warn(`row ${row}: unknown character tag "${t}"`);
  }
  // Tags from the Sheet win; otherwise fall back to the generated tags file.
  const gen = tagFile[String(id)];
  if (!g(C.character) && gen) {
    if (!mode && (gen.mode === "major" || gen.mode === "minor")) mode = gen.mode;
    if (gen.pace === "slow" || gen.pace === "moderate" || gen.pace === "lively") pace = gen.pace;
    for (const c of gen.character) if ((CHARACTER as readonly string[]).includes(c) && !character.includes(c)) character.push(c);
  }
  const rec = judged[String(id)];
  const popRaw = g(C.popularity).toLowerCase();
  let popularity: Piece["popularity"] = popRaw.startsWith("well") ? "well-known" : popRaw.startsWith("lesser") ? "lesser-known" : null;
  if (!popRaw) {
    // "well-known" is generous; "lesser-known" needs both models to agree and few views, otherwise no label
    const views = rec && rec.confidence !== "none" ? rec.maxViews : 0;
    const opus = popOpus[String(id)];
    const sonnet = gen?.popularity;
    if (views >= 250_000 || opus === "well-known" || (sonnet === "well-known" && opus !== "lesser-known")) popularity = "well-known";
    else if (opus === "lesser-known" && sonnet !== "well-known" && views < 50_000) popularity = "lesser-known";
  }

  let recording: Recording | null =
    rec?.video && ACCEPT.has(rec.confidence)
      ? { id: rec.video.id, title: rec.video.title, channel: rec.video.channel, seconds: rec.video.seconds, alternates: rec.alternates }
      : null;
  const override = youtubeId(g(C.override));
  if (override) recording = { id: override, title: "", channel: "", seconds: null, alternates: [] };

  const set = g(C.set) || null;
  pieces.push({
    id,
    slug: slugify(`${surname(composer)} ${title}`),
    composer,
    composerName: firstLast(composer),
    composerSlug: slugify(composer),
    title,
    level,
    type: type ?? "short",
    settings: settings ?? ["other"],
    accompaniment,
    era: era ?? "20th-century",
    dates: g(C.dates),
    nationality: g(C.nat),
    gender: g(C.gender) === "Female" ? "F" : g(C.gender) === "Male" ? "M" : "",
    minutes: minutes && Number.isFinite(minutes) ? minutes : null,
    notes: g(C.notes),
    exams,
    examBoards,
    imslp: g(C.score) !== "",
    ...(imslpPages[String(id)] ? { imslpPage: imslpPages[String(id)] } : {}),
    set,
    setKey: set ? slugify(`${surname(composer)} ${set}`) : null,
    mode,
    pace,
    character,
    popularity,
    recording,
  });
}

// A video the judge picked for several pieces (movement vs complete work, No. 2 vs No. 12…) is kept
// for at most one of them: the clear best fit by length, then confidence, then "No. N", then title words.
{
  const byVideo = new Map<string, Piece[]>();
  for (const p of pieces) {
    if (!p.recording || !p.recording.title) continue; // Sheet overrides have no title and are never deduped
    byVideo.set(p.recording.id, [...(byVideo.get(p.recording.id) ?? []), p]);
  }
  const words = (s: string) => fold(s).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const nums = (s: string) => [...fold(s).toLowerCase().matchAll(/\b(?:no|nr)\.? ?(\d+)/g)].map((m) => m[1]);
  const unique = (group: Piece[], ok: (p: Piece) => boolean) => {
    const hits = group.filter(ok);
    return hits.length === 1 ? hits[0] : null;
  };
  let dropped = 0;
  for (const group of byVideo.values()) {
    if (group.length < 2) continue;
    const v = group[0].recording!;
    const vWords = new Set(words(v.title));
    const vNums = new Set(nums(v.title));
    const fits = (p: Piece) => p.minutes != null && v.seconds != null && Math.abs(Math.log(v.seconds / 60 / p.minutes)) < Math.log(1.6);
    const keep =
      unique(group, fits) ??
      unique(group, (p) => judged[String(p.id)]?.confidence === "high") ??
      unique(group, (p) => nums(p.title).length > 0 && nums(p.title).every((n) => vNums.has(n))) ??
      unique(group, (p) => {
        const name = new Set(words(p.composer));
        const w = words(p.title.replace(/\([^)]*\)/g, "")).filter((x) => !name.has(x));
        return w.length > 0 && w.every((x) => vWords.has(x));
      });
    for (const p of group) if (p !== keep) {
      p.recording = null;
      dropped++;
    }
  }
  if (dropped) console.log(`Recordings: dropped ${dropped} that shared a video with another piece`);
}

const PieceSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  composer: z.string().min(1),
  level: z.number().int().min(1).max(10),
  settings: z.array(z.string()).min(1),
  minutes: z.number().positive().nullable(),
});
for (const p of pieces) {
  const res = PieceSchema.safeParse(p);
  if (!res.success) warn(`id ${p.id}: ${res.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`);
}

if (errors.length) {
  console.error(`Data build failed with ${errors.length} problem(s):\n  ` + errors.slice(0, 40).join("\n  "));
  process.exit(1);
}

pieces.sort((a, b) => a.id - b.id);
const version = createHash("sha1").update(JSON.stringify(pieces)).digest("hex").slice(0, 10);
const catalogue: Catalogue = { version, levels: levels.levels, levelNote: levels.note, pieces };

for (const dir of ["data/build", "public/data"]) mkdirSync(join(ROOT, dir), { recursive: true });
const json = JSON.stringify(catalogue);
if (PREVIEW) {
  mkdirSync(join(ROOT, "data/expansion/preview"), { recursive: true });
  writeFileSync(join(ROOT, "data/expansion/preview/catalogue.json"), json);
} else {
  writeFileSync(join(ROOT, "data/build/catalogue.json"), json);
  writeFileSync(join(ROOT, "public/data/catalogue.json"), json);
}

// Compact one-line-per-piece catalogue for the advisor's (cached) system prompt.
// Grouped by composer to save tokens: "# Bruch, Max" then "id|title|level|type|setting|min|tags|pop".
const TYPE_CODE: Record<string, string> = {
  concerto: "co", sonata: "so", short: "sh", showpiece: "vs", concertpiece: "cp",
  suite: "su", solo: "sw", duet: "du", etude: "et", technique: "te",
};
const SETTING_CODE: Record<string, string> = { solo: "un", piano: "pn", orchestra: "or", continuo: "bc", duo: "vv", other: "ot" };
const line = (p: Piece) =>
  [
    p.id,
    p.title,
    p.level,
    TYPE_CODE[p.type],
    p.settings.map((s) => SETTING_CODE[s]).join("+"),
    p.minutes ?? "",
    // mode only when the title doesn't already name the key; pace and character tags stay out of the prompt
    // (they'd push it past Haiku's 100K-token price step) and come back with every search_catalogue result
    /\bin [A-G](?:-flat|-sharp)? (?:major|minor)\b/.test(p.title) ? "" : p.mode === "major" ? "maj" : p.mode === "minor" ? "min" : "",
    p.popularity === "well-known" ? "W" : p.popularity === "lesser-known" ? "L" : "",
  ]
    .join("|")
    .replace(/\|+$/, "");
// The whole catalogue stays searchable through the advisor's search_catalogue tool, but its cached prompt only lists the
// best-known and most-taught works: Haiku 5.5 costs 5× more per token once a request passes 100K tokens, and the
// complete list no longer fits under that step. Works are ranked by popularity, syllabus listings, recording views and
// whether they were in the original Sheet; the budget (characters, ~0.635 tokens each) keeps the prompt near 83K tokens.
const PROMPT_CHARS = Number(process.env.PROMPT_CHARS ?? 124_000);
const ORIGINAL_MAX_ID = 2253;
const views = (p: Piece) => {
  const j = judged[String(p.id)];
  return j && j.confidence !== "none" ? j.maxViews : 0;
};
const importance = (p: Piece) =>
  (p.popularity === "well-known" ? 4 : p.popularity === "lesser-known" ? -1 : 0) +
  (p.examBoards.length ? 1.5 + Math.min(p.examBoards.length, 4) * 0.25 : 0) +
  (views(p) >= 500_000 ? 2 : views(p) >= 100_000 ? 1.5 : views(p) >= 20_000 ? 0.75 : 0) +
  (p.id <= ORIGINAL_MAX_ID ? 1 : 0);
const headerLen = (c: string) => c.length + 12;
const listed = new Set<number>();
{
  let chars = 0;
  const withHeader = new Set<string>();
  for (const p of [...pieces].sort((a, b) => importance(b) - importance(a) || a.id - b.id)) {
    const cost = line(p).length + 1 + (withHeader.has(p.composer) ? 0 : headerLen(p.composer));
    if (chars + cost > PROMPT_CHARS) continue;
    chars += cost;
    withHeader.add(p.composer);
    listed.add(p.id);
  }
}
const byComposer = new Map<string, Piece[]>();
const totals = new Map<string, number>();
for (const p of [...pieces].sort((a, b) => a.composer.localeCompare(b.composer) || a.level - b.level)) {
  totals.set(p.composer, (totals.get(p.composer) ?? 0) + 1);
  if (listed.has(p.id)) byComposer.set(p.composer, [...(byComposer.get(p.composer) ?? []), p]);
}
const catalogueText = [...byComposer.values()]
  .map((ps) => {
    const c = ps[0];
    const more = totals.get(c.composer)! > ps.length ? ` — ${ps.length} of ${totals.get(c.composer)} listed` : "";
    return `# ${c.composer}${c.gender === "F" ? " (woman)" : ""}${more}\n${ps.map(line).join("\n")}`;
  })
  .join("\n");
if (!PREVIEW)
  writeFileSync(
    join(ROOT, "lib/advisor/catalogue-text.ts"),
    `// Generated by scripts/build-data.ts — do not edit.\nexport const CATALOGUE_VERSION = ${JSON.stringify(version)};\nexport const CATALOGUE_TOTAL = ${pieces.length};\nexport const CATALOGUE_LISTED = ${listed.size};\nexport const CATALOGUE_TEXT = ${JSON.stringify(catalogueText)};\n`,
  );
else writeFileSync(join(ROOT, "data/expansion/preview/catalogue-text.txt"), catalogueText);
console.log(`advisor prompt lists ${listed.size} of ${pieces.length} works (${catalogueText.length} chars)`);

const sets = new Set(pieces.filter((p) => p.setKey).map((p) => p.setKey));
console.log(
  `catalogue ${version}: ${pieces.length} pieces, ${sets.size} sets, ` +
    `${pieces.filter((p) => p.recording).length} recordings, ${(json.length / 1024).toFixed(0)} KB`,
);
