/**
 * Pass 2 — completeness from knowledge. Per composer: "what violin works are missing from this list?"
 * Catches works that IMSLP does not host (copyright) and established arrangements that pass 1 could not see.
 * Every proposal must name an edition (publisher/year or IMSLP); the web-verification step checks them afterwards.
 *
 *   npx tsx --env-file=.env.local scripts/expand/pass2.ts [composer substring …]    writes data/expansion/pass2/<slug>.json
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ACCOMPANIMENTS, CATEGORIES, ROOT, anchorLines, ask, existingLine, loadRows, pool, read, slug, spentSoFar, write } from "./common";

const { rows } = loadRows();
const targets: string[] = read("data/expansion/target-composers-sheet-names.json");

// reuse the scope / style / level text of pass 1
const pass1src = require("node:fs").readFileSync(join(ROOT, "scripts/expand/pass1.ts"), "utf8") as string;
const P1 = pass1src.split("const SYSTEM = `")[1].split("`;\n\nconst SCHEMA")[0];
const STYLE =
  P1.slice(P1.indexOf("## Scope"), P1.indexOf("## How to answer each item")) + P1.slice(P1.indexOf("## House style of entries"));

const SYSTEM = `You are an expert violin teacher, performer and music librarian completing a graded violin-repertoire database ("Arco Repertoire", ~2,250+ works graded 1–10). You will receive, for ONE composer, the list of works already in the database. Your job: from your own knowledge of the composer's complete output and of the violin repertoire, name the violin works that are MISSING from the list.

Think systematically, in this order, before answering:
1. The composer's complete work list (opus/catalogue order). Which items are for violin (solo, with piano/orchestra/continuo/guitar/harp, duos, double concertos)? Are they all on the list?
2. Pieces that exist as violin-and-piano versions made by the composer or an early publisher (songs, piano pieces, orchestral excerpts the composer himself arranged).
3. ESTABLISHED arrangements of this composer's music for violin made by notable violinists (Kreisler, Heifetz, Auer, Joachim, Elman, Zimbalist, Kochański, Szigeti, Milstein, Wilhelmj, Burmester, Hubay, Sarasate, Ysaÿe, Hartmann, Franko, Press, Achron, Dushkin, Székely, Tsyganov, Garban, Roques …) that are published, taught or recorded.
4. Works that IMSLP does not host because of copyright (twentieth-century composers) but that have published editions (Schott, Boosey, Universal, Peters, Henle, Sikorski, Durand, Editio Musica Budapest, Bärenreiter, Carl Fischer …).

Rules:
- Only works that have a published edition you can name (publisher and approximate year, or "IMSLP"). Put it in "edition". If you cannot name one, omit the work.
- Never invent a work, a title or a catalogue number. If you are not sure a work exists, leave it out. An omission is better than an error.
- Do not repeat anything already on the list (even with a slightly different title or spelling), and do not list the same piece twice.
- Same scope, house style, categories, accompaniment values and level scale as below. Fill every field; the level rules apply.
- "evidence": one short phrase on how you know it (e.g. "Peters 1928, Heifetz transcription; recorded by Heifetz", "Op. 45 in the composer's work list; Henle HN 1234").
- confidence: "high" only when you are certain the work, its title and catalogue number are right.

${STYLE}
`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["missing", "notes"],
  properties: {
    notes: { type: "string", description: "one or two sentences: how complete the list was and anything systematic you noticed" },
    missing: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "level", "category", "accompaniment", "minutes", "set", "notes", "arranger", "confidence", "level_basis", "edition", "evidence"],
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
          edition: { type: "string" },
          evidence: { type: "string" },
        },
      },
    },
  },
};

async function run(composer: string) {
  const out = `data/expansion/pass2/${slug(composer)}.json`;
  if (existsSync(join(ROOT, out))) return;
  const p1 = existsSync(join(ROOT, `data/expansion/pass1/${slug(composer)}.json`)) ? read(`data/expansion/pass1/${slug(composer)}.json`) : { decisions: [] };
  const mine = rows.filter((r) => r.composer === composer);
  const info = mine[0];
  const added = p1.decisions.flatMap((d: any) => d.entries.map((e: any) => `NEW|${e.title}|L${e.level}|${e.category}|${e.accompaniment}|${e.minutes || "?"}min`));
  const levels = read("data/source/levels.json").levels.map((l: any) => `${l.level} = ${l.name} (about ${l.exam})`).join("\n");
  const system = SYSTEM.replace("{LEVELS}", levels).replace("{ANCHORS}", anchorLines(rows));
  const user = `Composer: ${composer} (${info?.dates ?? ""}, ${info?.nat ?? ""}; era: ${info?.era ?? ""})

Works already in the database (id|title|level|category|accompaniment|minutes|set):
${mine.map(existingLine).join("\n")}

Works already queued for addition from IMSLP:
${added.join("\n") || "(none)"}

List the violin works by ${composer.split(",")[0]} (including established arrangements of his/her music) that are missing from both lists.`;
  const res = await ask<{ missing: any[]; notes: string }>({ label: `pass2 ${composer}`, system, user, schema: SCHEMA, effort: "high", maxTokens: 40000 });
  write(out, { composer, ...res });
  console.log(`${composer}: ${res.missing.length} proposed — ${res.notes.slice(0, 120)}; spent $${spentSoFar().toFixed(2)}`);
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
