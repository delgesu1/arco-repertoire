/**
 * Turns the chamber section's data into the site's chamber catalogue (docs/chamber-music-plan.md).
 *
 *   data/chamber/works.json       the works (source of truth; check them with `npx tsx scripts/chamber/check.ts`)
 *   data/chamber/composers.json   metadata for composers who have no violin entries
 *   data/build/catalogue.json     the violin catalogue: composer metadata, and the works listed in both sections
 *   data/source/levels.json       level names / exam equivalents
 *   data/chamber/recordings-judged.json   YouTube picks for chamber-only works (scripts/chamber/recordings.ts); optional
 *
 * Writes data/build/chamber.json (server), public/data/chamber.json (client), the chamber advisor's catalogue
 * (lib/advisor/chamber-catalogue-text.ts) and the composers with chamber works only (lib/chamber/chamber-only-composers.ts).
 * Run it after scripts/build-data.ts.
 * A work also in the violin catalogue (violinId) keeps its violin id, address and recording, so it is one entry in both.
 *
 *   npx tsx scripts/build-chamber.ts
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FORM_CODES, hardestCode, scoringCode } from "../lib/advisor/chamber-codes";
import type { ChamberCatalogue, ChamberComposer, ChamberPiece, ChamberWork, InstrumentKey } from "../lib/chamber/types";
import { FORMATIONS, FORMS, INSTRUMENTS } from "../lib/chamber/vocab";
import type { Catalogue, EraKey, Piece } from "../lib/types";
import { firstLast, slugify, surname } from "./names";
import { assertNoExcludedPerformers } from "./recording-rules";

const ROOT = join(__dirname, "..");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const works: ChamberWork[] = read("data/chamber/works.json");
const chamberComposers: Record<string, ChamberComposer> = read("data/chamber/composers.json");
const violin = (read("data/build/catalogue.json") as Catalogue).pieces;
const levels = read("data/source/levels.json");
interface Judged {
  confidence: "high" | "medium" | "low" | "none";
  video: { id: string; title: string | null; channel: string | null; seconds: number | null; views?: number | null } | null;
  alternates: string[];
  compilation?: boolean;
}
const judged: Record<string, Judged> = existsSync(join(ROOT, "data/chamber/recordings-judged.json")) ? read("data/chamber/recordings-judged.json") : {};
// the works' details (scripts/parse_imslp_details.py, details_merge.py): IMSLP's average duration fills a missing length, and
// the other titles a work is known by are searched (not shown)
const imslpDetails: Record<string, { minutes?: number }> = existsSync(join(ROOT, "data/details/imslp.json")) ? read("data/details/imslp.json") : {};
const workDetails: Record<string, { otherTitles?: string[] }> = existsSync(join(ROOT, "data/details/works.json")) ? read("data/details/works.json") : {};
// the violin section's picks, for the views of the works listed in both sections
const violinJudged: Record<string, Judged> = existsSync(join(ROOT, "data/recordings-judged.json")) ? read("data/recordings-judged.json") : {};
const recordingOf = (id: number): Piece["recording"] => {
  const j = judged[String(id)];
  return j?.video && (j.confidence === "high" || j.confidence === "medium")
    ? { id: j.video.id, title: j.video.title ?? "", channel: j.video.channel ?? "", seconds: j.video.seconds, alternates: j.alternates }
    : null;
};

const errors: string[] = [];
const err = (w: ChamberWork, m: string) => errors.push(`${w.id} ${w.title}: ${m}`);

// composers in the violin catalogue take their metadata from its rows (their era: the one most of their rows have)
const violinById = new Map(violin.map((p) => [p.id, p]));
const fromViolin = new Map<string, { dates: string; nationality: string; gender: Piece["gender"]; eras: Map<EraKey, number> }>();
for (const p of violin) {
  const c = fromViolin.get(p.composer) ?? { dates: p.dates, nationality: p.nationality, gender: p.gender, eras: new Map() };
  c.eras.set(p.era, (c.eras.get(p.era) ?? 0) + 1);
  fromViolin.set(p.composer, c);
}
const composerMeta = (name: string): ChamberComposer | null => {
  const v = fromViolin.get(name);
  if (v) return { dates: v.dates, nationality: v.nationality, gender: v.gender, era: [...v.eras].sort((a, b) => b[1] - a[1])[0][0] };
  return chamberComposers[name] ?? null;
};

const known = <K extends string>(keys: Iterable<K>, k: string): k is K => [...keys].includes(k as K);
const formations = FORMATIONS.map((f) => f.key);
const forms = FORMS.map((f) => f.key);

const pieces: ChamberPiece[] = [];
const seen = new Set<number>();
for (const w of works) {
  const meta = composerMeta(w.composer);
  if (!meta) err(w, `composer "${w.composer}" is neither in the violin catalogue nor in data/chamber/composers.json`);
  // a name the vocabulary does not know fails the build (as unknown accompaniments do in build-data.ts)
  for (const k of [
    ...Object.keys(w.instruments),
    ...Object.keys(w.optional ?? {}),
    ...Object.keys(w.alternatives ?? {}),
    ...Object.values(w.alternatives ?? {}).flat(),
  ])
    if (!known(Object.keys(INSTRUMENTS), k)) err(w, `unknown instrument "${k}" (add it to INSTRUMENTS in lib/chamber/vocab.ts)`);
  if (!known(formations, w.formation)) err(w, `unknown formation "${w.formation}"`);
  if (!known(forms, w.form)) err(w, `unknown form "${w.form}"`);
  if (!Number.isInteger(w.level) || w.level < 1 || w.level > 10) err(w, `level ${w.level} is not 1–10`);

  const v = w.violinId != null ? violinById.get(w.violinId) : undefined;
  if (w.violinId != null && !v) err(w, `violinId ${w.violinId} is not in the violin catalogue`);
  if (!v && (w.id < 100001 || violinById.has(w.id))) err(w, `id ${w.id} is not a chamber id (100001 up)`);
  const id = v?.id ?? w.id;
  if (seen.has(id)) err(w, `duplicate id ${id}`);
  seen.add(id);

  const key = w.title.match(/\bin [A-G](?:-flat|-sharp)? (major|minor)\b/)?.[1] as "major" | "minor" | undefined;
  pieces.push({
    id,
    slug: v?.slug ?? slugify(`${surname(w.composer)} ${w.title}`),
    composer: w.composer,
    composerName: firstLast(w.composer),
    composerSlug: slugify(w.composer),
    title: w.title,
    level: w.level,
    era: w.era ?? meta?.era ?? "20th-century",
    dates: meta?.dates ?? "",
    nationality: meta?.nationality ?? "",
    gender: meta?.gender ?? "",
    minutes: w.minutes ?? imslpDetails[String(id)]?.minutes ?? null,
    notes: w.notes || v?.notes || "",
    ...(w.imslpPage ?? v?.imslpPage ? { imslpPage: w.imslpPage ?? v?.imslpPage } : {}),
    set: w.set,
    setKey: w.set ? slugify(`${surname(w.composer)} ${w.set}`) : null,
    mode: w.mode ?? key ?? null,
    pace: w.pace ?? null,
    character: w.character ?? [],
    popularity: w.popularity,
    recording: v ? v.recording : recordingOf(w.id),
    sections: v ? ["violin", "chamber"] : ["chamber"],
    ...(workDetails[String(id)]?.otherTitles?.length ? { alsoTitled: workDetails[String(id)].otherTitles } : {}),
    chamber: {
      formation: w.formation,
      instruments: w.instruments,
      ...(w.alternatives ? { alternatives: w.alternatives } : {}),
      ...(w.optional ? { optional: w.optional as Partial<Record<InstrumentKey, number>> } : {}),
      players: w.players,
      form: w.form,
      hardestPart: w.hardestPart,
      year: w.year,
      ...(w.aka?.length ? { aka: w.aka } : {}),
    },
  });
}

if (errors.length) {
  console.error(`Chamber build failed with ${errors.length} problem(s):\n  ` + errors.slice(0, 40).join("\n  "));
  process.exit(1);
}

// a video two chamber-only works share (one search answering two) stays with the work its length fits best, unless it is
// an album or programme that includes both (compilation)
{
  const byVideo = new Map<string, ChamberPiece[]>();
  for (const p of pieces)
    if (p.recording && !p.sections.includes("violin") && !judged[String(p.id)]?.compilation) byVideo.set(p.recording.id, [...(byVideo.get(p.recording.id) ?? []), p]);
  let dropped = 0;
  for (const group of byVideo.values()) {
    if (group.length < 2) continue;
    const secs = group[0].recording!.seconds;
    const fit = (p: ChamberPiece) => (p.minutes && secs ? Math.abs(Math.log(secs / 60 / p.minutes)) : 9);
    const keep = [...group].sort((a, b) => fit(a) - fit(b))[0];
    for (const p of group)
      if (p !== keep) {
        p.recording = null;
        dropped++;
      }
  }
  if (dropped) console.log(`Recordings: dropped ${dropped} that shared a video with another work`);
}

assertNoExcludedPerformers(pieces); // docs/recording-rules.md

pieces.sort((a, b) => a.id - b.id);
const version = createHash("sha1").update(JSON.stringify(pieces)).digest("hex").slice(0, 10);
const catalogue: ChamberCatalogue = { version, levels: levels.levels, pieces };
const json = JSON.stringify(catalogue);
for (const dir of ["data/build", "public/data"]) mkdirSync(join(ROOT, dir), { recursive: true });
writeFileSync(join(ROOT, "data/build/chamber.json"), json);
writeFileSync(join(ROOT, "public/data/chamber.json"), json);
// ── the chamber advisor's catalogue ────────────────────────────────────
// Its cached prompt lists the best-known works, one compact line each, under a character budget that keeps it well below
// Haiku's 100K-token price step (as scripts/build-data.ts does for the violin advisor): the prompt and tools come to about 62K
// tokens, which leaves a conversation room for several turns of tool results. Every work stays reachable through the tools.
// Renown: the "well-known" mark, an approved benchmark, and the views of the work's recording on the site.
const PROMPT_CHARS = Number(process.env.CHAMBER_PROMPT_CHARS ?? 85_000);
const workOf = new Map(works.map((w) => [w.violinId ?? w.id, w]));
const views = (p: ChamberPiece) =>
  p.recording ? ((p.sections.includes("violin") ? violinJudged : judged)[String(p.id)]?.video?.views ?? 0) : 0;
const renown = (p: ChamberPiece) => {
  const v = views(p);
  return (
    (p.popularity === "well-known" ? 4 : 0) +
    (workOf.get(p.id)?.benchmark === "approved" ? 1 : 0) +
    (v >= 1_000_000 ? 3 : v >= 300_000 ? 2.5 : v >= 100_000 ? 2 : v >= 30_000 ? 1.5 : v >= 10_000 ? 1 : v >= 3_000 ? 0.5 : 0)
  );
};
const byRenown = [...pieces].sort((a, b) => renown(b) - renown(a) || a.id - b.id);
const line = (p: ChamberPiece) =>
  [
    p.id,
    p.title,
    p.level,
    scoringCode(p.chamber),
    hardestCode(p.chamber.hardestPart),
    p.minutes ?? "",
    FORM_CODES[p.chamber.form],
    /\bin [A-G](?:-flat|-sharp)? (?:major|minor)\b/.test(p.title) ? "" : p.mode === "major" ? "maj" : p.mode === "minor" ? "min" : "",
    p.popularity === "well-known" ? "W" : "",
  ]
    .join("|")
    .replace(/\|+$/, "");
const listed = new Set<number>();
{
  let chars = 0;
  const withHeader = new Set<string>();
  const add = (p: ChamberPiece) => {
    if (listed.has(p.id)) return;
    const cost = line(p).length + 1 + (withHeader.has(p.composer) ? 0 : p.composer.length + 12);
    if (chars + cost > PROMPT_CHARS) return;
    chars += cost;
    withHeader.add(p.composer);
    listed.add(p.id);
  };
  // every ensemble gets its best-known 30 in first (viol consorts and continuo sonatas have few views), then the rest by renown
  for (const f of FORMATIONS) byRenown.filter((p) => p.chamber.formation === f.key).slice(0, 30).forEach(add);
  byRenown.forEach(add);
}
const listedBy = new Map<string, ChamberPiece[]>();
const composerTotals = new Map<string, number>();
for (const p of [...pieces].sort((a, b) => a.composer.localeCompare(b.composer) || a.level - b.level || a.title.localeCompare(b.title))) {
  composerTotals.set(p.composer, (composerTotals.get(p.composer) ?? 0) + 1);
  if (listed.has(p.id)) listedBy.set(p.composer, [...(listedBy.get(p.composer) ?? []), p]);
}
const catalogueText = [...listedBy.values()]
  .map((ps) => {
    const c = ps[0];
    const more = composerTotals.get(c.composer)! > ps.length ? ` — ${ps.length} of ${composerTotals.get(c.composer)} listed` : "";
    return `# ${c.composer}${c.gender === "F" ? " (woman)" : ""}${more}\n${ps.map(line).join("\n")}`;
  })
  .join("\n");
writeFileSync(
  join(ROOT, "lib/advisor/chamber-catalogue-text.ts"),
  `// Generated by scripts/build-chamber.ts — do not edit.\nexport const CHAMBER_CATALOGUE_VERSION = ${JSON.stringify(version)};\n` +
    `export const CHAMBER_TOTAL = ${pieces.length};\nexport const CHAMBER_LISTED = ${listed.size};\n` +
    `/** every work's id, best-known first (the order the advisor's tools list their matches in) */\n` +
    `export const CHAMBER_BY_RENOWN: number[] = ${JSON.stringify(byRenown.map((p) => p.id))};\n` +
    `export const CHAMBER_CATALOGUE_TEXT = ${JSON.stringify(catalogueText)};\n`,
);
console.log(`chamber advisor prompt lists ${listed.size} of ${pieces.length} works (${catalogueText.length} chars)`);

// the header treats their composer pages as chamber pages (lib/chamber/launch.ts isChamberPath); it ships to the browser, so
// it holds the slugs alone
const violinSlugs = new Set(violin.map((p) => p.composerSlug));
const chamberOnlyComposers = [...new Set(pieces.map((p) => p.composerSlug))].filter((s) => !violinSlugs.has(s)).sort();
writeFileSync(
  join(ROOT, "lib/chamber/chamber-only-composers.ts"),
  `// Generated by scripts/build-chamber.ts — do not edit.\n/** the composers with chamber works only (no violin entries) */\n` +
    `export const CHAMBER_ONLY_COMPOSERS: string[] = ${JSON.stringify(chamberOnlyComposers)};\n`,
);

console.log(
  `chamber ${version}: ${pieces.length} works (${pieces.filter((p) => p.sections.includes("violin")).length} also in the violin catalogue), ` +
    `${(json.length / 1024).toFixed(0)} KB`,
);
