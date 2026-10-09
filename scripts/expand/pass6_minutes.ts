/**
 * Pass 6 — estimated durations for existing rows of the target composers that have none, so the "length" filter covers them.
 *   npx tsx --env-file=.env.local scripts/expand/pass6_minutes.ts        writes data/expansion/pass6/minutes.json  {id: minutes}
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, ask, loadRows, read, write, spentSoFar } from "./common";

const OUT = "data/expansion/pass6/minutes.json";
const targets = new Set<string>(read("data/expansion/target-composers-sheet-names.json"));
const { rows } = loadRows();
const todo = rows.filter((r) => targets.has(r.composer) && !r.min);
const SYSTEM = `You are an experienced violinist estimating performance lengths for a repertoire database. For each work give the typical performance time of THE WHOLE ENTRY as listed (a single piece, a movement, or a complete collection when the title says so), in whole minutes (minimum 1). Use your knowledge of the piece; when you only know the form and the composer, estimate from the form (a Baroque trio or violin sonata is 8–14 min, a Kaleidoscope-style miniature 1–3 min, a Paganini Centone sonata about 3–4 min, a prelude of 1–2 min is 1 or 2). Never answer 0.`;
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["items"],
  properties: { items: { type: "array", items: { type: "object", additionalProperties: false, required: ["id", "minutes"], properties: { id: { type: "integer" }, minutes: { type: "integer" } } } } },
};
async function main() {
  const out: Record<string, number> = existsSync(join(ROOT, OUT)) ? read(OUT) : {};
  const left = todo.filter((r) => !out[r.id]);
  for (let i = 0; i < left.length; i += 60) {
    const chunk = left.slice(i, i + 60);
    const user = `Estimate minutes for these ${chunk.length} entries (id|composer|title|category|accompaniment|set):\n` + chunk.map((r) => `${r.id}|${r.composer}|${r.title}|${r.category}|${r.acc}|${r.set}`).join("\n");
    const res = await ask<{ items: { id: number; minutes: number }[] }>({ label: `pass6 minutes ${i}`, system: SYSTEM, user, schema: SCHEMA, effort: "medium", maxTokens: 8000 });
    for (const it of res.items) if (it.minutes >= 1) out[it.id] = it.minutes;
  }
  write(OUT, out);
  console.log(`${Object.keys(out).length}/${todo.length} durations estimated; spent $${spentSoFar().toFixed(2)}`);
}
main();
