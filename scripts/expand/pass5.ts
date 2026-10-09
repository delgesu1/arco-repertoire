/**
 * Pass 5 — a blind second opinion on the levels of the NEW entries (from data/expansion/final/added.json).
 * The grader sees the composer's existing entries and the global anchors but none of the first-pass levels.
 * merge.ts then averages the two grades (see LEVEL BLEND there).
 *
 *   npx tsx --env-file=.env.local scripts/expand/pass5.ts [composer substring …]     writes data/expansion/pass5/<slug>.json
 *   P5_MODEL=claude-opus-5-5 …                                                       to use another model (default Sonnet 5.5)
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, anchorLines, ask, existingLine, loadRows, pool, read, slug, spentSoFar, write } from "./common";

const { rows } = loadRows();
const added: any[] = read("data/expansion/final/added.json");
const MODEL = process.env.P5_MODEL ?? "claude-sonnet-5-5";

const SYSTEM = `You are an expert violin teacher grading repertoire for a database ("Arco Repertoire") on a 1–10 teaching-difficulty scale. For each work you receive, give the level a student or professional would need to learn the WHOLE work (movements and short arrangements are easier than complete works).

{LEVELS}

Calibrate against the anchors below and against the composer's existing entries (given with the batch): equal difficulty, equal level. Use the whole range; do not default to the middle. Obscure salon pieces by the same composer are usually graded relative to that composer's known pieces. Use "low" confidence when you do not know the piece and are inferring from its type, key, length and composer.

## Anchors from the database
{ANCHORS}
`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["grades"],
  properties: {
    grades: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["uid", "level", "confidence"],
        properties: {
          uid: { type: "string" },
          level: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
      },
    },
  },
};

async function run(composer: string) {
  const s = slug(composer);
  const out = `data/expansion/pass5/${s}.json`;
  const prior: { grades: any[] } = existsSync(join(ROOT, out)) ? read(out) : { grades: [] };
  const done = new Set(prior.grades.map((g) => g.uid));
  const mine = added.filter((e) => e.composer === composer && !done.has(e.uid)); // incremental: only entries not graded yet
  if (!mine.length) return;
  const existing = rows.filter((r) => r.composer === composer);
  const levels = read("data/source/levels.json").levels.map((l: any) => `${l.level} = ${l.name} (about ${l.exam})`).join("\n");
  const system = SYSTEM.replace("{LEVELS}", levels).replace("{ANCHORS}", anchorLines(rows));
  const grades: any[] = [...prior.grades];
  const CHUNK = 70;
  for (let i = 0; i < mine.length; i += CHUNK) {
    const chunk = mine.slice(i, i + CHUNK);
    const user = `Composer: ${composer}

Existing entries for this composer (id|title|level|category|accompaniment|minutes|set):
${existing.map(existingLine).join("\n") || "(none)"}

Grade these ${chunk.length} works (uid|title|category|accompaniment|minutes|set):
${chunk.map((e) => `${e.uid}|${e.title}|${e.category}|${e.accompaniment}|${e.minutes || "?"} min${e.set ? `|set: ${e.set}` : ""}`).join("\n")}`;
    const res = await ask<{ grades: any[] }>({ label: `pass5 ${composer} ${i}`, model: MODEL, system, user, schema: SCHEMA, effort: "high", maxTokens: 30000 });
    grades.push(...res.grades);
  }
  write(out, { composer, model: MODEL, grades });
  console.log(`${composer}: graded ${grades.length} (${mine.length} new); spent $${spentSoFar().toFixed(2)}`);
}

async function main() {
  const only = process.argv.slice(2).map((s) => s.toLowerCase());
  const composers = [...new Set(added.map((e) => e.composer))].filter((c) => !only.length || only.some((o) => c.toLowerCase().includes(o)));
  await pool(composers, 4, async (c) => {
    try {
      await run(c);
    } catch (e) {
      console.error(`FAILED ${c}: ${e instanceof Error ? e.message : e}`);
    }
  });
  console.log(`done; total spent $${spentSoFar().toFixed(2)}`);
}
void readFileSync;
main();
