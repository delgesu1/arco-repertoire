/**
 * Pass 4 — turn the web agents' "gaps" (works they found that the draft missed) into proper catalogue entries:
 * house-style title, category, accompaniment, minutes, set and a level calibrated against the composer's own list.
 *
 *   npx tsx --env-file=.env.local scripts/expand/pass4.ts [composer substring …]    writes data/expansion/pass4/<slug>.json
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ACCOMPANIMENTS, CATEGORIES, ROOT, anchorLines, ask, existingLine, loadRows, pool, read, slug, spentSoFar, write } from "./common";

const { rows } = loadRows();
const targets: string[] = read("data/expansion/target-composers-sheet-names.json");
const P1 = (readFileSync(join(ROOT, "scripts/expand/pass1.ts"), "utf8").split("const SYSTEM = `")[1] ?? "").split("`;\n\nconst SCHEMA")[0];
const STYLE = P1.slice(P1.indexOf("## Scope"), P1.indexOf("## How to answer each item")) + P1.slice(P1.indexOf("## House style of entries"));

const SYSTEM = `You are an expert violin teacher and music librarian finishing entries for a graded violin-repertoire database ("Arco Repertoire"). A researcher has verified, from web sources, that the works below exist and are missing from the database. Turn each one into a catalogue entry: house-style title (keep the verified catalogue numbers exactly, never add numbers you have not been given), category, accompaniment, realistic minutes, set and a calibrated level. Drop an item (return it in "skipped" with a reason) only if it duplicates a work already listed (even under a different title or arrangement) or is clearly out of scope. Do not invent notes: leave "notes" empty unless you know the piece well.

${STYLE}
## Level scale
{LEVELS}

## Level anchors from the database
{ANCHORS}
`;

const ENTRY = {
  type: "object",
  additionalProperties: false,
  required: ["title", "level", "category", "accompaniment", "minutes", "set", "notes", "arranger", "confidence", "level_basis", "source_ref"],
  properties: {
    title: { type: "string" },
    level: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    category: { type: "string", enum: [...CATEGORIES] },
    accompaniment: { type: "string", enum: [...ACCOMPANIMENTS] },
    minutes: { type: "integer" },
    set: { type: "string" },
    notes: { type: "string" },
    arranger: { type: "string" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    level_basis: { type: "string" },
    source_ref: { type: "string", description: "the source URL given for this work" },
  },
};
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["entries", "skipped"],
  properties: {
    entries: { type: "array", items: ENTRY },
    skipped: { type: "array", items: { type: "object", additionalProperties: false, required: ["title", "reason"], properties: { title: { type: "string" }, reason: { type: "string" } } } },
  },
};

async function run(composer: string) {
  const s = slug(composer);
  const web = `data/expansion/web/${s}.json`;
  const out = `data/expansion/pass4/${s}.json`;
  if (!existsSync(join(ROOT, web)) || existsSync(join(ROOT, out))) return;
  // the researchers flag marginal finds themselves ("OPTIONAL", "LOW PRIORITY": published but unrecorded, instrument-primary…): left out
  const allGaps: any[] = read(web).gaps ?? [];
  const gaps = allGaps.filter((g) => !/^\s*(optional|low priority)/i.test(g.note ?? ""));
  if (gaps.length < allGaps.length) console.log(`${composer}: ${allGaps.length - gaps.length} marginal gap(s) left out`);
  if (!gaps.length) {
    write(out, { composer, entries: [], skipped: [] });
    return;
  }
  const rev = read(`data/expansion/review/${s}.json`);
  const mine = rows.filter((r) => r.composer === composer);
  const info = mine[0];
  const levels = read("data/source/levels.json").levels.map((l: any) => `${l.level} = ${l.name} (about ${l.exam})`).join("\n");
  const system = SYSTEM.replace("{LEVELS}", levels).replace("{ANCHORS}", anchorLines(rows));
  const user = `Composer: ${composer} (${info?.dates ?? ""}, ${info?.nat ?? ""}; era: ${info?.era ?? ""})

Existing entries (id|title|level|category|accompaniment|minutes|set):
${mine.map(existingLine).join("\n")}

Entries already queued for addition (title|level):
${rev.queued.map((q: any) => `${q.title}|L${q.level}`).join("\n") || "(none)"}

Verified works to turn into entries (researcher's notes; levels there are rough guesses):
${gaps.map((g: any, i: number) => `${i + 1}. ${g.title} | scoring: ${g.scoring} | ${g.category} | ~${g.minutes} min | level guess ${g.level_guess} | set: ${g.set || "-"} | arranger: ${g.arranger || "-"} | edition: ${g.edition} | ${g.source} | ${g.note || ""}`).join("\n")}`;
  const res = await ask<any>({ label: `pass4 ${composer}`, system, user, schema: SCHEMA, effort: "high", maxTokens: 32000 });
  write(out, { composer, ...res });
  console.log(`${composer}: ${res.entries.length} entries, ${res.skipped.length} skipped; spent $${spentSoFar().toFixed(2)}`);
}

async function main() {
  const only = process.argv.slice(2).map((s) => s.toLowerCase());
  const todo = targets.filter((t) => !only.length || only.some((o) => t.toLowerCase().includes(o)));
  await pool(todo, 4, async (c) => {
    try {
      await run(c);
    } catch (e) {
      console.error(`FAILED ${c}: ${e instanceof Error ? e.message : e}`);
    }
  });
  console.log(`done; total spent $${spentSoFar().toFixed(2)}`);
}
main();
