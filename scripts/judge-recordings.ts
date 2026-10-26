/**
 * Picks one YouTube recording per piece from the candidates collected by collect_recordings.py.
 *
 *   npx tsx --env-file=.env.local scripts/judge-recordings.ts submit   # pre-filter + submit a Message Batch
 *   npx tsx --env-file=.env.local scripts/judge-recordings.ts collect  # fetch results, check embeddability,
 *                                                                       # write data/recordings-judged.json
 *   npx tsx --env-file=.env.local scripts/judge-recordings.ts direct   # same judging at normal speed, only for pieces not yet judged
 *   npx tsx scripts/judge-recordings.ts export | apply                  # judging by reviewers instead of the API (no key needed), see exportCandidates()
 * Rules narrow the candidates; Claude Haiku 5.5 makes the final call (Batch API, strict JSON schema).
 */
import Anthropic from "@anthropic-ai/sdk";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalogue, Piece } from "../lib/types";
import { settingLabel, typeSingular } from "../lib/vocab";
import { fold } from "../lib/search";
import { featuresExcludedPerformer } from "./recording-rules";

const ROOT = join(__dirname, "..");
const CACHE = join(ROOT, "data/cache/yt");
const CACHE2 = join(ROOT, "data/cache/yt2");
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
  // yt = first search ("<composer> <title> violin"), yt2 = second, plainer query for pieces the first one did not settle (collect_recordings.py CACHE_NAME=yt2 PLAIN=1)
  const files = [join(CACHE, `${p.id}.json`), join(CACHE2, `${p.id}.json`)].filter(existsSync);
  if (!files.length) return [];
  const seen = new Set<string>();
  const entries = files.flatMap((f) => (JSON.parse(readFileSync(f, "utf8")) as { entries: Entry[] }).entries).filter((e) => e?.id && !seen.has(e.id) && seen.add(e.id));
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
    if (featuresExcludedPerformer(e.title, e.channel, e.description)) return false; // docs/recording-rules.md
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


/**
 * Judging without the API: `export` writes the pre-filtered candidates of the pieces that have no judged record yet
 * (restricted to the ids in ONLY_IDS_FILE, a snapshot like data/cache/modern-only.json, when set) to data/expansion/modern/recordings/to-judge-<n>.json
 * for reviewers; `apply` reads their answers (data/expansion/modern/recordings/choices-*.json: {"<id>": {choice, confidence, alternates, reason}})
 * and stores them exactly as `direct` would (embeddability check included).
 */
async function exportCandidates() {
  const out: Record<string, unknown> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const relaxed = !!process.env.RELAXED; // pieces still without a usable recording: albums / programmes that include the work are acceptable now
  const cat = relaxed ? (JSON.parse(readFileSync(join(ROOT, "data/build/catalogue.json"), "utf8")) as Catalogue).pieces : [];
  const noRec = new Set(cat.filter((p) => !p.recording).map((p) => String(p.id)));
  const only = process.env.ONLY_IDS_FILE
    ? new Set((JSON.parse(readFileSync(join(ROOT, process.env.ONLY_IDS_FILE), "utf8")).values as string[][]).slice(1).map((r) => String(r[16])))
    : null;
  const items = [];
  let none = 0;
  for (const p of pieces) {
    if (relaxed ? !noRec.has(String(p.id)) : out[String(p.id)]) continue;
    if (only && !only.has(String(p.id))) continue;
    const c = candidates(p);
    if (!c.length) { none++; continue; }
    items.push({
      id: p.id, composer: p.composerName, work: p.title, type: typeSingular(p.type), setting: `${p.settings.map(settingLabel).join(", ")} (${p.accompaniment})`,
      expected_minutes: p.minutes ?? null,
      previous_pick: relaxed ? ((out[String(p.id)] as { video?: { id: string } | null } | undefined)?.video?.id ?? null) : undefined,
      candidates: c.map((e) => ({ id: e.id, title: e.title, channel: e.channel, verified: !!e.channel_is_verified, minutes: e.duration != null ? Math.round(e.duration / 60) : null, views: e.view_count })),
    });
  }
  const N = Number(process.env.CHUNKS ?? 4);
  const dir = join(ROOT, "data/expansion/modern/recordings");
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < N; i++) writeFileSync(join(dir, `to-judge-${relaxed ? "r" : ""}${i + 1}.json`), JSON.stringify({ chunk: i + 1, items: items.filter((_, k) => k % N === i) }, null, 1));
  console.log(`${items.length} pieces with candidates exported in ${N} chunks (${none} without usable candidates)`);
}

async function applyChoices() {
  const dir = join(ROOT, "data/expansion/modern/recordings");
  const out: Record<string, unknown> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const byId = new Map(pieces.map((p) => [String(p.id), p]));
  let n = 0, picked = 0;
  const relaxed = !!process.env.RELAXED; // choices-r*.json: override the earlier "none" / deduped records; "compilation": true marks an album or programme that includes the work
  for (const f of readdirSync(dir).filter((f) => (relaxed ? /^choices-r.*\.json$/ : /^choices-\d.*\.json$/).test(f))) {
    const j = JSON.parse(readFileSync(join(dir, f), "utf8")) as Record<string, Judgement & { compilation?: boolean }>;
    for (const [id, ch] of Object.entries(j)) {
      const p = byId.get(id);
      if (!p || (out[id] && !relaxed)) continue;
      if (relaxed && ch.choice === "none") continue; // keep what was there
      out[id] = { ...(await record(p, { choice: ch.choice, confidence: ch.confidence ?? "medium", alternates: ch.alternates ?? [], reason: ch.reason ?? "" })), ...(ch.compilation ? { compilation: true } : {}) };
      n++;
      if ((out[id] as { video: unknown }).video) picked++;
    }
  }
  // pieces without usable candidates are recorded as such, like `direct` does
  for (const p of pieces) if (!out[String(p.id)] && existsSync(join(CACHE, `${p.id}.json`)) && !candidates(p).length) out[String(p.id)] = { confidence: "none", reason: "no usable candidates", video: null, alternates: [], viewScore: 0, maxViews: 0 };
  writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log(`applied ${n} judgements, ${picked} with an embeddable video`);
}

const cmd = process.argv[2];
if (cmd === "submit") submit();
else if (cmd === "collect") collect();
else if (cmd === "direct") direct();
else if (cmd === "export") exportCandidates();
else if (cmd === "apply") applyChoices();
else if (cmd === "stats") {
  let none = 0, total = 0;
  for (const p of pieces) {
    total++;
    if (!candidates(p).length) none++;
  }
  console.log({ total, withoutCandidates: none });
} else console.log("usage: judge-recordings.ts submit|collect|direct|stats");
