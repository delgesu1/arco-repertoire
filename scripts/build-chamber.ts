/**
 * Turns the chamber section's data into the site's chamber catalogue (docs/chamber-music-plan.md).
 *
 *   data/chamber/works.json       the works (source of truth; check them with `npx tsx scripts/chamber/check.ts`)
 *   data/chamber/composers.json   metadata for composers who have no violin entries
 *   data/build/catalogue.json     the violin catalogue: composer metadata, and the works listed in both sections
 *   data/source/levels.json       level names / exam equivalents
 *   data/chamber/recordings-judged.json   YouTube picks for chamber-only works (scripts/chamber/recordings.ts); optional
 *
 * Writes data/build/chamber.json (server) and public/data/chamber.json (client). Run it after scripts/build-data.ts.
 * A work also in the violin catalogue (violinId) keeps its violin id, address and recording, so it is one entry in both.
 *
 *   npx tsx scripts/build-chamber.ts
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberCatalogue, ChamberComposer, ChamberPiece, ChamberWork, InstrumentKey } from "../lib/chamber/types";
import { FORMATIONS, FORMS, INSTRUMENTS } from "../lib/chamber/vocab";
import type { Catalogue, EraKey, Piece } from "../lib/types";
import { firstLast, slugify, surname } from "./names";

const ROOT = join(__dirname, "..");
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), "utf8"));

const works: ChamberWork[] = read("data/chamber/works.json");
const chamberComposers: Record<string, ChamberComposer> = read("data/chamber/composers.json");
const violin = (read("data/build/catalogue.json") as Catalogue).pieces;
const levels = read("data/source/levels.json");
interface Judged {
  confidence: "high" | "medium" | "low" | "none";
  video: { id: string; title: string | null; channel: string | null; seconds: number | null } | null;
  alternates: string[];
  compilation?: boolean;
}
const judged: Record<string, Judged> = existsSync(join(ROOT, "data/chamber/recordings-judged.json")) ? read("data/chamber/recordings-judged.json") : {};
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
    minutes: w.minutes,
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

pieces.sort((a, b) => a.id - b.id);
const version = createHash("sha1").update(JSON.stringify(pieces)).digest("hex").slice(0, 10);
const catalogue: ChamberCatalogue = { version, levels: levels.levels, pieces };
const json = JSON.stringify(catalogue);
for (const dir of ["data/build", "public/data"]) mkdirSync(join(ROOT, dir), { recursive: true });
writeFileSync(join(ROOT, "data/build/chamber.json"), json);
writeFileSync(join(ROOT, "public/data/chamber.json"), json);
console.log(
  `chamber ${version}: ${pieces.length} works (${pieces.filter((p) => p.sections.includes("violin")).length} also in the violin catalogue), ` +
    `${(json.length / 1024).toFixed(0)} KB`,
);
