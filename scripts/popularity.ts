/**
 * Second opinion on "well-known" vs "lesser-known" from Claude Opus 5.5 (titles only, so it's cheap).
 * The build only calls a work lesser-known when this and the tagging pass agree and its recordings have few views.
 *
 *   npx tsx --env-file=.env.local scripts/popularity.ts    # writes data/popularity-opus.json (resumable)
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalogue, Piece } from "../lib/types";
import { settingLabel, typeSingular } from "../lib/vocab";

const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "data/popularity-opus.json");
const MODEL = "claude-opus-5-5";
const PER_REQUEST = 120;

const pieces: Piece[] = (JSON.parse(readFileSync(join(ROOT, "data/build/catalogue.json"), "utf8")) as Catalogue).pieces;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["pieces"],
  properties: {
    pieces: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "popularity"],
        properties: {
          id: { type: "integer" },
          popularity: { type: "string", enum: ["well-known", "lesser-known", "unsure"] },
        },
      },
    },
  },
};

const SYSTEM = `You are an experienced violinist and violin teacher. For each work, say how familiar it is to violinists and violin teachers today.

- "well-known": most violin teachers would recognise it, or it is a standard of the teaching, recital, encore or competition repertoire (for example Monti's Csárdás, the Bach partitas, Meditation from Thaïs, the student concertos of Seitz and Rieding). Famous individual movements count too.
- "lesser-known": genuinely rarely heard or taught; a typical teacher would not know it.
- "unsure": you don't know enough about the work to judge.

Judge the specific work (and arrangement), not just the composer. When a work is somewhere in between, prefer "unsure" over "lesser-known".`;

const line = (p: Piece) => `id=${p.id} | ${p.composerName} | ${p.title} | ${typeSingular(p.type)} (${p.settings.map(settingLabel).join(", ")}) | level ${p.level}`;

async function main() {
  const client = new Anthropic({ maxRetries: 6 });
  const out: Record<string, string> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const chunks: Piece[][] = [];
  for (let i = 0; i < pieces.length; i += PER_REQUEST) chunks.push(pieces.slice(i, i + PER_REQUEST));
  const todo = chunks.filter((c) => c.some((p) => !out[p.id]));
  let inTok = 0, outTok = 0;
  const worker = async () => {
    for (let chunk = todo.shift(); chunk; chunk = todo.shift()) {
      try {
        const msg = await client.messages
          .stream({
            model: MODEL,
            max_tokens: 16000,
            system: SYSTEM,
            output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
            messages: [{ role: "user", content: `Rate these ${chunk.length} works:\n\n${chunk.map(line).join("\n")}` }],
          })
          .finalMessage();
        inTok += msg.usage.input_tokens;
        outTok += msg.usage.output_tokens;
        const text = msg.content.find((b) => b.type === "text");
        if (msg.stop_reason !== "end_turn" || !text || text.type !== "text") throw new Error(`stop_reason ${msg.stop_reason}`);
        for (const t of JSON.parse(text.text).pieces) out[String(t.id)] = t.popularity;
        writeFileSync(OUT, JSON.stringify(out, null, 1));
      } catch (e) {
        console.error(`chunk starting at id ${chunk[0].id} failed: ${e instanceof Error ? e.message : e}`);
      }
    }
  };
  await Promise.all(Array.from({ length: 5 }, worker));
  const counts: Record<string, number> = {};
  for (const v of Object.values(out)) counts[v] = (counts[v] ?? 0) + 1;
  console.log(`Rated ${Object.keys(out).length}/${pieces.length}:`, counts, `tokens in/out ${inTok}/${outTok} ≈ $${((inTok * 4 + outTok * 20) / 1e6).toFixed(2)}`);
}

main();
