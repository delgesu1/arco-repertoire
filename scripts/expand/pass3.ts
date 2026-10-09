/**
 * Pass 3 — audit of one composer's whole list (existing entries + queued additions):
 * demonstrable fact errors, levels that are clearly off, duplicates.
 *
 *   npx tsx --env-file=.env.local scripts/expand/pass3.ts [composer substring …]   writes data/expansion/pass3/<slug>.json
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ACCOMPANIMENTS, CATEGORIES, ROOT, anchorLines, ask, existingLine, loadRows, pool, read, slug, spentSoFar, write } from "./common";

const { rows } = loadRows();
const targets: string[] = read("data/expansion/target-composers-sheet-names.json");

const pass1src = readFileSync(join(ROOT, "scripts/expand/pass1.ts"), "utf8");
const P1 = pass1src.split("const SYSTEM = `")[1].split("`;\n\nconst SCHEMA")[0];
const STYLE = P1.slice(P1.indexOf("## House style of entries"));

const SYSTEM = `You are an expert violin teacher and music librarian auditing a graded violin-repertoire database ("Arco Repertoire"). You receive ONE composer's complete list: entries already in the database (numeric ids) and entries about to be added (ids like N12). Check three things and report ONLY changes — leave everything else alone.

1. FACTS (numeric ids): title wording, catalogue/opus number, key, movement/number, category, accompaniment, minutes, set. Correct only what is demonstrably wrong, using the IMSLP details provided with the entry or knowledge you are certain about. Do not "improve" titles that are merely styled differently but correct. Real problems look like: a wrong or missing opus/catalogue number, wrong key, a title that belongs to a different work, wrong numbering within a set, a short piece filed as Concerto, accompaniment that contradicts the scoring, minutes that are wildly off (a 3-minute piece at 12 minutes). For each give the full corrected value of that field.
2. LEVELS (all ids): flag a level only if you are confident it is wrong — at least 2 levels away from where comparable works in the list or the anchors put it, or 1 level away with clear exam evidence (the exam text is shown: ABRSM 8 ≈ level 5, ABRSM 7 ≈ 4, RCM 10 ≈ 6, ARSM ≈ 6, DipABRSM/ATCL ≈ 7, LRSM/LTCL ≈ 8, FRSM/FTCL ≈ 9). Within one composer, related works should be ordered sensibly (easier salon pieces below the concertos, early sonatas below late ones, etc.). Movements/short arrangements are usually easier than complete works.
3. DUPLICATES: two entries that are the same work (the same piece listed twice under different titles or spellings, or a queued entry that duplicates an existing one). Name the one to keep (prefer the existing numeric id, or the better-titled entry) and the ones to remove. Entries that are different arrangements, different movements, or a complete set versus its members are NOT duplicates.

Confidence: "high" = you are certain; "medium" = probably; do not report "low" guesses at all. Reasons are one short sentence naming the evidence.

${STYLE}
## Level scale
{LEVELS}

## Level anchors from the database
{ANCHORS}
`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fixes", "levels", "duplicates", "notes"],
  properties: {
    notes: { type: "string" },
    fixes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "field", "value", "confidence", "reason"],
        properties: {
          id: { type: "string" },
          field: { type: "string", enum: ["title", "category", "accompaniment", "minutes", "set", "notes"] },
          value: { type: "string" },
          confidence: { type: "string", enum: ["high", "medium"] },
          reason: { type: "string" },
        },
      },
    },
    levels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "level", "confidence", "reason"],
        properties: {
          id: { type: "string" },
          level: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
          confidence: { type: "string", enum: ["high", "medium"] },
          reason: { type: "string" },
        },
      },
    },
    duplicates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["keep", "remove", "reason"],
        properties: { keep: { type: "string" }, remove: { type: "array", items: { type: "string" } }, reason: { type: "string" } },
      },
    },
  },
};
void CATEGORIES;
void ACCOMPANIMENTS;

function imslpNote(pageid: number): string {
  const f = join(ROOT, "data/cache/imslp-wiki", `${pageid}.json`);
  if (!existsSync(f)) return "";
  const w = JSON.parse(readFileSync(f, "utf8"));
  const i = w.info ?? {};
  const bits = [w.title.replace(/ \([^()]*\)$/, "")];
  if (i["Year/Date of Composition"]) bits.push(i["Year/Date of Composition"]);
  if (i["Average Duration"]) bits.push(i["Average Duration"]);
  const parts = i["Number of Movements/Sections"];
  if (parts) bits.push(parts.replace(/level=\d+\|number=\d+\|title=/g, "").slice(0, 110));
  return `[IMSLP: ${bits.join("; ")}]`;
}

async function run(composer: string) {
  const out = `data/expansion/pass3/${slug(composer)}.json`;
  if (existsSync(join(ROOT, out))) return;
  const mine = rows.filter((r) => r.composer === composer);
  const info = mine[0];
  const p1f = `data/expansion/pass1/${slug(composer)}.json`;
  const p2f = `data/expansion/pass2/${slug(composer)}.json`;
  if (!existsSync(join(ROOT, p2f))) return; // N-ids depend on pass 2 being final
  const p1 = existsSync(join(ROOT, p1f)) ? read(p1f) : { decisions: [] };
  const p2 = read(p2f);
  const imslpFor = new Map<number, string>();
  for (const d of p1.decisions) for (const id of d.covered_ids) if (!imslpFor.has(id)) imslpFor.set(id, imslpNote(d.pageid));
  const lines = mine.map((r) => `${existingLine(r)}${r.exams ? ` {exams: ${r.exams.slice(0, 90)}}` : ""} ${imslpFor.get(r.id) ?? ""}`.trim());
  const news: any[] = [...p1.decisions.flatMap((d: any) => d.entries.map((e: any) => ({ ...e, src: d.page }))), ...p2.missing.map((e: any) => ({ ...e, src: "knowledge" }))];
  const newLines = news.map((e, i) => `N${i + 1}|${e.title}|L${e.level}|${e.category}|${e.accompaniment}|${e.minutes || "?"}min${e.set ? `|set: ${e.set}` : ""}|conf:${e.confidence}`);
  const levels = read("data/source/levels.json").levels.map((l: any) => `${l.level} = ${l.name} (about ${l.exam})`).join("\n");
  const system = SYSTEM.replace("{LEVELS}", levels).replace("{ANCHORS}", anchorLines(rows));
  const user = `Composer: ${composer} (${info?.dates ?? ""}, ${info?.nat ?? ""}; era: ${info?.era ?? ""})

EXISTING entries (id|title|level|category|accompaniment|minutes|set), with exam listings and IMSLP details where known:
${lines.join("\n")}

QUEUED additions (N-id|title|level|category|accompaniment|minutes|set|confidence):
${newLines.join("\n") || "(none)"}`;
  const res = await ask<any>({ label: `pass3 ${composer}`, system, user, schema: SCHEMA, effort: "high", maxTokens: 40000 });
  write(out, { composer, queued: news.map((e, i) => ({ nid: `N${i + 1}`, title: e.title })), ...res });
  console.log(
    `${composer}: ${res.fixes.length} fixes, ${res.levels.length} level changes, ${res.duplicates.length} duplicate groups (existing ${mine.length}, queued ${news.length}); spent $${spentSoFar().toFixed(2)}`,
  );
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
