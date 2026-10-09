/**
 * Picks one YouTube recording per piece from the candidates collected by collect_recordings.py.
 *
 *   npx tsx --env-file=.env.local scripts/judge-recordings.ts submit   # pre-filter + submit a Message Batch
 *   npx tsx --env-file=.env.local scripts/judge-recordings.ts collect  # fetch results, check embeddability,
 *                                                                       # write data/recordings-judged.json
 *   npx tsx --env-file=.env.local scripts/judge-recordings.ts direct   # same judging at normal speed, only for pieces not yet judged
 * Rules narrow the candidates; Claude Haiku 5.5 makes the final call (Batch API, strict JSON schema).
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalogue, Piece } from "../lib/types";
import { settingLabel, typeSingular } from "../lib/vocab";
import { fold } from "../lib/search";

const ROOT = join(__dirname, "..");
const CACHE = join(ROOT, "data/cache/yt");
const STATE = join(ROOT, "data/cache/judge-batch.json");
const OUT = join(ROOT, "data/recordings-judged.json");
const MODEL = "claude-haiku-5-5";

interface Entry {
  id: string;
  title: string | null;
  duration: number | null;
  view_count: number | null;
  channel: string | null;
  channel_is_verified: boolean | null;
  description: string | null;
  live_status: string | null;
}

const REJECT =
  /\b(lesson|tutorial|how to play|play[- ]?along|accompaniment|backing track|karaoke|sheet music|piano part|minus one|slow practice|practice track|suzuki|#shorts|reaction|unboxing)\b/i;
const OTHER_INSTRUMENTS = /\b(cello|viola|flute|clarinet|oboe|trumpet|saxophone|sax|guitar|piano solo|organ|accordion|harp)\b/i;
const VIOLIN_WORDS = /violin|violon|violino|geige|violine|skrzyp|скрипк|hegedű|houslov|fiddle/i;

const pieces: Piece[] = (JSON.parse(readFileSync(join(ROOT, process.env.CATALOGUE_JSON ?? "data/build/catalogue.json"), "utf8")) as Catalogue).pieces;

function candidates(p: Piece): Entry[] {
  const f = join(CACHE, `${p.id}.json`);
  if (!existsSync(f)) return [];
  const { entries } = JSON.parse(readFileSync(f, "utf8")) as { entries: Entry[] };
  // Names as words: "Coleridge-Taylor" → coleridge|taylor; "Saint-Georges, Joseph Bologne" → georges|bologne…
  const [last, ...given] = fold(p.composer).split(",");
  const words = (s: string, min: number) =>
    s.split(/[^a-z]+/).filter((w) => w.length >= min && !["saint", "von", "van", "der", "del", "de", "la"].includes(w));
  const nameWords = [...words(last, 3), ...words(given.join(" "), 6)];
  const multiMovement = ["concerto", "sonata", "suite", "duet"].includes(p.type) && (p.minutes ?? 99) > 8;
  const allowsOther = OTHER_INSTRUMENTS.test(p.accompaniment) || OTHER_INSTRUMENTS.test(p.title);
  return entries.filter((e) => {
    if (!e.id || !e.title || e.live_status === "is_live" || e.live_status === "is_upcoming") return false;
    const text = ` ${fold(`${e.title} ${e.channel ?? ""} ${e.description ?? ""}`).replace(/[^a-z]+/g, " ")} `;
    if (!nameWords.some((w) => text.includes(` ${w} `) || text.includes(` ${w}s `))) return false;
    if (REJECT.test(e.title)) return false;
    if (!allowsOther && OTHER_INSTRUMENTS.test(e.title) && !VIOLIN_WORDS.test(e.title)) return false;
    if (e.duration != null && e.duration < 45) return false;
    if (multiMovement && e.duration != null && p.minutes && e.duration < p.minutes * 60 * 0.45) return false;
    return true;
  });
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["choice", "confidence", "alternates", "reason"],
  properties: {
    choice: { type: "string", description: "videoId of the best candidate, or 'none'" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    alternates: { type: "array", items: { type: "string" }, description: "up to 2 other acceptable videoIds" },
    reason: { type: "string", description: "one short sentence" },
  },
};

function prompt(p: Piece, cands: Entry[]): string {
  const lines = cands.map(
    (e) =>
      `- id=${e.id} | "${e.title}" | channel: ${e.channel ?? "?"}${e.channel_is_verified ? " (verified)" : ""} | ` +
      `${e.duration != null ? `${Math.round(e.duration / 60)} min` : "? min"} | ${e.view_count ?? "?"} views`,
  );
  return `You are choosing a YouTube video to embed on a violin repertoire website, next to this work:

Composer: ${p.composerName}
Work: ${p.title}
Type: ${typeSingular(p.type)}; setting: ${p.settings.map(settingLabel).join(", ")} (${p.accompaniment})
Expected length of the complete work: ${p.minutes ? `about ${p.minutes} min` : "unknown"}

Candidates:
${lines.join("\n")}

Pick the candidate that is a performance of THIS exact work, played on the violin, and complete (all movements; not a single movement or excerpt — unless the work itself is a single movement). Score-following videos of a real performance are fine. Reject: other works by the same composer (watch numbers: "No. 1" is not "No. 10"; check opus/catalogue numbers and keys), arrangements for other instruments, lessons, play-alongs, piano-only accompaniment tracks, compilations of many works. Prefer professional or well-known performances (more views, official or "- Topic" channels) when several are acceptable.
If none is clearly acceptable, answer choice "none". Use confidence "high" only when title, catalogue/number and duration all fit.`;
}

async function submit() {
  const client = new Anthropic();
  const requests = [];
  const skipped: number[] = [];
  for (const p of pieces) {
    const c = candidates(p);
    if (!c.length) {
      skipped.push(p.id);
      continue;
    }
    requests.push({
      custom_id: String(p.id),
      params: {
        model: MODEL,
        max_tokens: 4000,
        output_config: { effort: "medium" as const, format: { type: "json_schema" as const, schema: SCHEMA } },
        messages: [{ role: "user" as const, content: prompt(p, c) }],
      },
    });
  }
  const batch = await client.messages.batches.create({ requests });
  writeFileSync(STATE, JSON.stringify({ id: batch.id, skipped, submitted: requests.length }));
  console.log(`Submitted batch ${batch.id}: ${requests.length} pieces (${skipped.length} had no usable candidates)`);
}

async function embeddable(id: string): Promise<boolean> {
  const r = await fetch(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${id}`);
  return r.ok;
}

type Judgement = { choice: string; confidence: string; alternates: string[]; reason: string };

/** turn the judge's answer into the stored record (embeddability check, view totals) */
async function record(p: Piece, j: Judgement) {
  const cands = candidates(p);
  const meta = (vid: string) => cands.find((e) => e.id === vid);
  const ids = [j.choice, ...j.alternates].filter((v) => v !== "none" && meta(v));
  const ok: string[] = [];
  for (const v of ids) if (await embeddable(v)) ok.push(v);
  const views = cands.filter((e) => ids.includes(e.id)).reduce((s, e) => s + Math.log10(1 + (e.view_count ?? 0)), 0);
  const best = ok[0] ? meta(ok[0])! : null;
  return {
    confidence: j.choice === "none" ? "none" : j.confidence,
    reason: j.reason,
    video: best ? { id: best.id, title: best.title, channel: best.channel, seconds: best.duration, views: best.view_count } : null,
    alternates: ok.slice(1),
    viewScore: Math.round(views * 100) / 100,
    maxViews: Math.max(0, ...cands.filter((e) => ids.includes(e.id)).map((e) => e.view_count ?? 0)),
  };
}

/** Normal-speed requests (Haiku is cheap), resumable: only pieces without a judged record are sent. */
async function direct() {
  const client = new Anthropic({ maxRetries: 6 });
  const out: Record<string, unknown> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const todo = pieces.filter((p) => !out[String(p.id)]);
  let n = 0;
  const failed: number[] = [];
  const worker = async () => {
    for (let p = todo.shift(); p; p = todo.shift()) {
      const c = candidates(p);
      if (!c.length) {
        out[String(p.id)] = { confidence: "none", reason: "no usable candidates", video: null, alternates: [], viewScore: 0, maxViews: 0 };
        continue;
      }
      try {
        const msg = await client.messages
          .stream({
            model: MODEL,
            max_tokens: 4000,
            output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
            messages: [{ role: "user", content: prompt(p, c) }],
          })
          .finalMessage();
        const text = msg.content.find((b) => b.type === "text");
        if (msg.stop_reason !== "end_turn" || !text || text.type !== "text") throw new Error(`stop_reason ${msg.stop_reason}`);
        out[String(p.id)] = await record(p, JSON.parse(text.text) as Judgement);
      } catch (e) {
        failed.push(p.id);
        console.error(`piece ${p.id} failed: ${e instanceof Error ? e.message : e}`);
      }
      if (++n % 25 === 0) {
        writeFileSync(OUT, JSON.stringify(out, null, 1));
        console.log(`${n} judged`);
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  const counts: Record<string, number> = {};
  for (const v of Object.values(out) as { confidence: string }[]) counts[v.confidence] = (counts[v.confidence] ?? 0) + 1;
  console.log(`Wrote ${OUT}`, counts, failed.length ? `${failed.length} failed` : "");
}

async function collect() {
  const client = new Anthropic();
  const { id, skipped } = JSON.parse(readFileSync(STATE, "utf8"));
  const batch = await client.messages.batches.retrieve(id);
  if (batch.processing_status !== "ended") {
    console.log(`Batch ${id} still ${batch.processing_status}:`, batch.request_counts);
    return;
  }
  const byId = new Map(pieces.map((p) => [String(p.id), p]));
  const out: Record<string, unknown> = {};
  let errors = 0;
  for await (const r of await client.messages.batches.results(id)) {
    if (r.result.type !== "succeeded") {
      errors++;
      continue;
    }
    const text = r.result.message.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") continue;
    const j = JSON.parse(text.text) as Judgement;
    out[r.custom_id] = await record(byId.get(r.custom_id)!, j);
  }
  for (const s of skipped) out[String(s)] = { confidence: "none", reason: "no usable candidates", video: null, alternates: [], viewScore: 0, maxViews: 0 };
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  const counts: Record<string, number> = {};
  for (const v of Object.values(out) as { confidence: string }[]) counts[v.confidence] = (counts[v.confidence] ?? 0) + 1;
  console.log(`Wrote ${OUT}`, counts, errors ? `${errors} errored` : "");
}

const cmd = process.argv[2];
if (cmd === "submit") submit();
else if (cmd === "collect") collect();
else if (cmd === "direct") direct();
else if (cmd === "stats") {
  let none = 0, total = 0;
  for (const p of pieces) {
    total++;
    if (!candidates(p).length) none++;
  }
  console.log({ total, withoutCandidates: none });
} else console.log("usage: judge-recordings.ts submit|collect|direct|stats");
