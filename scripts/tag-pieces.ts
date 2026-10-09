/**
 * Character ("vibe") tags for every piece, on Claude Sonnet 5.5 (normal requests or one Message Batch).
 *
 *   npx tsx --env-file=.env.local scripts/tag-pieces.ts submit
 *   npx tsx --env-file=.env.local scripts/tag-pieces.ts collect   # writes data/tags.json
 *   npx tsx --env-file=.env.local scripts/tag-pieces.ts direct    # same requests at normal speed (2× price), resumable
 *   npx tsx --env-file=.env.local scripts/tag-pieces.ts cancel    # cancel the submitted batch
 *
 * Vocabulary (kept small on purpose — these become filter chips):
 *   mode: major | minor            (taken from the title key when present; the model only fills the rest)
 *   pace: slow | moderate | lively (overall feel of the whole work)
 *   character: up to 3 of lyrical, dance, virtuosic, playful, dramatic, tender, dark, folk, heroic, humorous
 *   popularity: well-known | lesser-known (among violinists and teachers)
 * Every field allows "unsure"; unsure fields are simply left empty on the site.
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalogue, Piece } from "../lib/types";
import { CHARACTER, eraLabel, settingLabel, typeSingular } from "../lib/vocab";

const ROOT = join(__dirname, "..");
const STATE = join(ROOT, "data/cache/tag-batch.json");
const OUT = join(ROOT, "data/tags.json");
const MODEL = process.env.TAG_MODEL ?? "claude-sonnet-5-5";
// $ per million tokens, input/output, at normal speed
const PRICE: Record<string, [number, number]> = { "claude-sonnet-5-5": [2, 10], "claude-opus-5-5": [4, 20] };
const PER_REQUEST = 25;

const pieces: Piece[] = (JSON.parse(readFileSync(join(ROOT, process.env.CATALOGUE_JSON ?? "data/build/catalogue.json"), "utf8")) as Catalogue).pieces;

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
        required: ["id", "mode", "pace", "character", "popularity"],
        properties: {
          id: { type: "integer" },
          mode: { type: "string", enum: ["major", "minor", "unsure"] },
          pace: { type: "string", enum: ["slow", "moderate", "lively", "unsure"] },
          character: { type: "array", items: { type: "string", enum: [...CHARACTER] } },
          popularity: { type: "string", enum: ["well-known", "lesser-known", "unsure"] },
        },
      },
    },
  },
};

const SYSTEM = `You are an experienced violin teacher and repertoire expert tagging works for a repertoire finder. Teachers use these tags to judge at a glance whether a piece has the right overall "vibe" for a student.

For each work give:
- mode: the overall tonality of the work (for multi-movement works, the home key of the first/main movement). "unsure" if you don't actually know the piece.
- pace: the overall feel of the whole work — slow, moderate or lively. Multi-movement works with a fast finale and fast first movement are usually "lively"; a single slow romance is "slow".
- character: 1–3 tags from the list that a violinist would agree describe the piece. Use "virtuosic" only for genuinely showy writing; "folk" for folk/national dance or song idioms (Hungarian, Spanish, Jewish, American spiritual, etc.); "dance" for dance forms or dance character; "dark" for brooding/tragic; "tender" for intimate/gentle; "heroic" for grand/noble; "humorous" for witty/comic. Leave the list empty if you don't know the piece.
- popularity: "well-known" if the work is widely performed, recorded or taught (a typical violin teacher would recognise it); "lesser-known" if it is rarely heard; "unsure" if you can't tell.

Never guess about a work you don't know: use "unsure" and an empty character list. Accuracy matters more than coverage.`;

function line(p: Piece) {
  return [
    `id=${p.id}`,
    p.composerName,
    p.title,
    `${typeSingular(p.type)} (${p.settings.map(settingLabel).join(", ")})`,
    eraLabel(p.era),
    p.minutes ? `${p.minutes} min` : "",
    p.set ? `from: ${p.set}` : "",
    p.notes ? `notes: ${p.notes}` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

const chunks = () => {
  const out: Piece[][] = [];
  for (let i = 0; i < pieces.length; i += PER_REQUEST) out.push(pieces.slice(i, i + PER_REQUEST));
  return out;
};
const params = (chunk: Piece[]) => ({
  model: MODEL,
  max_tokens: 16000,
  system: SYSTEM,
  output_config: { effort: "medium" as const, format: { type: "json_schema" as const, schema: SCHEMA } },
  messages: [{ role: "user" as const, content: `Tag these ${chunk.length} works:\n\n${chunk.map(line).join("\n")}` }],
});
type Tags = Record<string, { mode: string; pace: string; character: string[]; popularity: string }>;

async function submit() {
  const client = new Anthropic();
  const requests = chunks().map((chunk, i) => ({ custom_id: `chunk-${i}`, params: params(chunk) }));
  const batch = await client.messages.batches.create({ requests });
  writeFileSync(STATE, JSON.stringify({ id: batch.id, requests: requests.length }));
  console.log(`Submitted batch ${batch.id}: ${requests.length} requests for ${pieces.length} pieces`);
}

async function collect() {
  const client = new Anthropic();
  const { id } = JSON.parse(readFileSync(STATE, "utf8"));
  const batch = await client.messages.batches.retrieve(id);
  if (batch.processing_status !== "ended") {
    console.log(`Batch ${id} still ${batch.processing_status}:`, batch.request_counts);
    return;
  }
  const out: Record<string, { mode: string; pace: string; character: string[]; popularity: string }> = {};
  const failed: string[] = [];
  let inTok = 0, outTok = 0;
  for await (const r of await client.messages.batches.results(id)) {
    if (r.result.type !== "succeeded") {
      failed.push(r.custom_id);
      continue;
    }
    inTok += r.result.message.usage.input_tokens;
    outTok += r.result.message.usage.output_tokens;
    const text = r.result.message.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      failed.push(r.custom_id);
      continue;
    }
    for (const t of JSON.parse(text.text).pieces) out[String(t.id)] = { ...t, character: t.character.slice(0, 3) };
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  const missing = pieces.filter((p) => !out[p.id]).map((p) => p.id);
  console.log(`Wrote ${Object.keys(out).length} tag sets to ${OUT}; failed requests: ${failed.join(", ") || "none"}; ` +
    `missing pieces: ${missing.length}; tokens in/out: ${inTok}/${outTok}`);
}

/** Normal-speed requests, a few at a time; progress is saved after each so a re-run only does what's missing. */
async function direct() {
  const client = new Anthropic({ maxRetries: 6 });
  const out: Tags = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const todo = chunks().filter((c) => c.some((p) => !out[p.id]));
  let inTok = 0, outTok = 0, done = 0;
  const failed: number[] = [];
  const worker = async () => {
    for (let chunk = todo.shift(); chunk; chunk = todo.shift()) {
      try {
        const msg = await client.messages.stream(params(chunk)).finalMessage();
        inTok += msg.usage.input_tokens;
        outTok += msg.usage.output_tokens;
        const text = msg.content.find((b) => b.type === "text");
        if (msg.stop_reason !== "end_turn" || !text || text.type !== "text") throw new Error(`stop_reason ${msg.stop_reason}`);
        for (const t of JSON.parse(text.text).pieces) out[String(t.id)] = { ...t, character: t.character.slice(0, 3) };
        writeFileSync(OUT, JSON.stringify(out, null, 1));
      } catch (e) {
        failed.push(chunk[0].id);
        console.error(`chunk starting at id ${chunk[0].id} failed: ${e instanceof Error ? e.message : e}`);
      }
      done++;
      if (done % 10 === 0) console.log(`${done} requests done`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  const missing = pieces.filter((p) => !out[p.id]).length;
  const [pi, po] = PRICE[MODEL] ?? [0, 0];
  const cost = (inTok * pi + outTok * po) / 1e6;
  console.log(`Tagged ${Object.keys(out).length} pieces (${missing} missing, ${failed.length} failed requests); ` +
    `tokens in/out ${inTok}/${outTok} ≈ $${cost.toFixed(2)}`);
}

async function cancel() {
  const { id } = JSON.parse(readFileSync(STATE, "utf8"));
  const b = await new Anthropic().messages.batches.cancel(id);
  console.log(`Batch ${id}: ${b.processing_status}`, b.request_counts);
}

const cmd = process.argv[2];
if (cmd === "submit") submit();
else if (cmd === "collect") collect();
else if (cmd === "direct") direct();
else if (cmd === "cancel") cancel();
else console.log("usage: tag-pieces.ts submit|collect|direct|cancel");
