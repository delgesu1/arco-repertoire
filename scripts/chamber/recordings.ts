/**
 * Phase 6: picks one YouTube recording per chamber work from the candidates of scripts/chamber/collect_recordings.py,
 * judged by reviewer agents (no API key; brief: data/chamber/recordings/BRIEF.md).
 *
 *   npx tsx scripts/chamber/recordings.ts export    # works with candidates and no judgement yet -> data/chamber/recordings/to-judge/jNNN.json
 *   npx tsx scripts/chamber/recordings.ts apply     # data/chamber/recordings/choices/jNNN.json -> data/chamber/recordings-judged.json
 *
 * Second pass, for the works still without a high- or medium-confidence video (candidates from collect_recordings2.py:
 * a reworded search per work and a search per set; only videos the first pass did not see; brief: BRIEF2.md):
 *   npx tsx scripts/chamber/recordings.ts export2   # -> data/chamber/recordings/to-judge/kNNN.json
 *   npx tsx scripts/chamber/recordings.ts apply2    # choices/kNNN.json -> recordings-judged.json (a pick replaces the entry; otherwise it is marked pass2)
 *
 * Export is incremental (it skips works already exported or judged), so it can run while collection is still going.
 * Apply checks that each chosen video can be embedded (YouTube oEmbed); scripts/build-chamber.ts attaches the
 * high- and medium-confidence picks and drops a video that two works share unless it is a compilation.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberWork } from "../../lib/chamber/types";
import { FORMATIONS, instrumentList } from "../../lib/chamber/vocab";
import { fold } from "../../lib/search";
import { featuresExcludedPerformer } from "../recording-rules";

const ROOT = join(__dirname, "..", "..");
const CACHE = join(ROOT, "data/cache/yt-chamber");
const CACHE2 = join(ROOT, "data/cache/yt-chamber-2");
const DIR = join(ROOT, "data/chamber/recordings");
const OUT = join(ROOT, "data/chamber/recordings-judged.json");
const CHUNK = 100;

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
interface Choice {
  choice: string;
  confidence: "high" | "medium" | "low";
  compilation?: boolean;
  alternates?: string[];
  reason?: string;
}

const works = (JSON.parse(readFileSync(join(ROOT, "data/chamber/works.json"), "utf8")) as ChamberWork[]).filter((w) => !w.violinId);
const label = (k: string) => FORMATIONS.find((f) => f.key === k)?.label ?? k;
const firstLast = (n: string) => (n.includes(", ") ? `${n.split(", ").slice(1).join(", ")} ${n.split(", ")[0]}` : n);
const REJECT =
  /\b(lesson|tutorial|how to play|play[- ]?along|accompaniment|backing track|karaoke|sheet music|minus one|slow practice|practice track|#shorts|reaction|unboxing|ai cover|midi|synthesia)\b/i;
// channels whose uploads are computer-played arrangements (notation-software playback), not performances
const REJECT_CHANNEL = /\bmagatagan\b/i;

const rawEntries = (f: string): Entry[] => (existsSync(f) ? ((JSON.parse(readFileSync(f, "utf8")) as { entries?: Entry[] }).entries ?? []) : []);

function candidates(w: ChamberWork): Entry[] {
  return usable(w, rawEntries(join(CACHE, `${w.id}.json`)));
}

/** collect_recordings2.py's key for a set's search */
const setKey = (w: ChamberWork) => createHash("sha1").update(`${w.composer}|${w.set}`).digest("hex").slice(0, 16);

/** second pass: the reworded work search and the set search, without any video the first pass already had */
function candidates2(w: ChamberWork): Entry[] {
  const seen = new Set(rawEntries(join(CACHE, `${w.id}.json`)).map((e) => e.id));
  const found = [...rawEntries(join(CACHE2, `${w.id}.json`)), ...(w.set ? rawEntries(join(CACHE2, "sets", `${setKey(w)}.json`)) : [])];
  const out = new Map<string, Entry>();
  for (const e of usable(w, found)) if (!seen.has(e.id) && !out.has(e.id)) out.set(e.id, e);
  return [...out.values()];
}

/** the search results worth showing a judge: the composer named, not a lesson or a short clip of a longer work */
function usable(w: ChamberWork, entries: Entry[]): Entry[] {
  const names = fold(w.composer).toLowerCase().split(/[^a-z]+/).filter((x) => x.length > 2);
  const surname = fold(w.composer.split(",")[0]).toLowerCase().split(/[^a-z]+/).filter((x) => x.length > 2);
  return entries.filter((e) => {
    if (!e?.id || !e.title || e.live_status === "is_upcoming") return false;
    if (REJECT.test(e.title) || REJECT_CHANNEL.test(e.channel ?? "")) return false;
    if (featuresExcludedPerformer(e.title, e.channel, e.description)) return false; // docs/recording-rules.md
    if (e.duration != null && e.duration < 60 && (w.minutes ?? 5) > 2) return false;
    if (e.duration != null && w.minutes && e.duration / 60 < 0.4 * w.minutes) return false; // far too short for the whole work
    const text = fold(`${e.title} ${e.channel ?? ""} ${e.description ?? ""}`).toLowerCase();
    return (surname.length ? surname : names).some((n) => text.includes(n));
  });
}

function judgedIds(): Set<string> {
  const ids = new Set<string>();
  if (existsSync(OUT)) for (const k of Object.keys(JSON.parse(readFileSync(OUT, "utf8")))) ids.add(k);
  const todo = join(DIR, "to-judge");
  if (existsSync(todo)) for (const f of readdirSync(todo)) for (const it of JSON.parse(readFileSync(join(todo, f), "utf8")).items) ids.add(String(it.id));
  return ids;
}

function exportChunks() {
  mkdirSync(join(DIR, "to-judge"), { recursive: true });
  mkdirSync(join(DIR, "choices"), { recursive: true });
  const done = judgedIds();
  const existing = readdirSync(join(DIR, "to-judge")).filter((f) => /^j\d+\.json$/.test(f)).length;
  const items: unknown[] = [];
  let noCandidates = 0;
  let notCollected = 0;
  for (const w of works) {
    if (done.has(String(w.id))) continue;
    if (!existsSync(join(CACHE, `${w.id}.json`))) {
      notCollected++;
      continue;
    }
    const c = candidates(w);
    if (!c.length) {
      noCandidates++;
      continue;
    }
    items.push({
      id: w.id,
      composer: firstLast(w.composer),
      work: w.title,
      ...(w.aka?.length ? { aka: w.aka } : {}),
      formation: label(w.formation),
      scoring: instrumentList(w.instruments, { alternatives: w.alternatives, optional: w.optional }),
      form: w.form,
      expected_minutes: w.minutes,
      candidates: c.map((e) => ({ id: e.id, title: e.title, channel: e.channel, verified: !!e.channel_is_verified, minutes: e.duration != null ? Math.round(e.duration / 60) : null, views: e.view_count })),
    });
  }
  const full = Math.floor(items.length / CHUNK); // keep a partial chunk for the next export, unless nothing is left to collect
  const n = notCollected ? full : Math.ceil(items.length / CHUNK);
  for (let i = 0; i < n; i++) {
    const name = `j${String(existing + i + 1).padStart(3, "0")}`;
    writeFileSync(join(DIR, "to-judge", `${name}.json`), JSON.stringify({ chunk: name, items: items.slice(i * CHUNK, (i + 1) * CHUNK) }, null, 1) + "\n");
  }
  console.log(`exported ${Math.min(items.length, n * CHUNK)} works in ${n} new chunks (j${String(existing + 1).padStart(3, "0")}…); ${items.length - Math.min(items.length, n * CHUNK)} held back for a full chunk; ${noCandidates} without usable candidates; ${notCollected} not collected yet`);
}

async function embeddable(id: string): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${id}`);
      if (r.status === 429 || r.status >= 500) throw new Error(String(r.status));
      return r.ok;
    } catch {
      await new Promise((res) => setTimeout(res, 2000 * (attempt + 1)));
    }
  }
  return false;
}

async function apply() {
  const out: Record<string, unknown> = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
  const byId = new Map(works.map((w) => [String(w.id), w]));
  const files = readdirSync(join(DIR, "choices")).filter((f) => f.endsWith(".json")).sort();
  let n = 0;
  let picked = 0;
  const jobs: [string, Choice][] = [];
  for (const f of files) for (const [id, ch] of Object.entries(JSON.parse(readFileSync(join(DIR, "choices", f), "utf8")) as Record<string, Choice>)) if (!out[id] && byId.has(id)) jobs.push([id, ch]);
  // a few at a time: oEmbed is polite to a handful of parallel requests
  for (let i = 0; i < jobs.length; i += 6) {
    await Promise.all(
      jobs.slice(i, i + 6).map(async ([id, ch]) => {
        const w = byId.get(id)!;
        const cands = candidates(w);
        const meta = (v: string) => cands.find((e) => e.id === v);
        const ids = [ch.choice, ...(ch.alternates ?? [])].filter((v) => v && v !== "none" && meta(v));
        const ok: string[] = [];
        for (const v of ids) if (await embeddable(v)) ok.push(v);
        const best = ok[0] ? meta(ok[0])! : null;
        out[id] = {
          confidence: ch.choice === "none" ? "none" : ch.confidence,
          reason: ch.reason ?? "",
          video: best ? { id: best.id, title: best.title, channel: best.channel, seconds: best.duration, views: best.view_count } : null,
          alternates: ok.slice(1),
          maxViews: Math.max(0, ...cands.filter((e) => ids.includes(e.id)).map((e) => e.view_count ?? 0)),
          ...(ch.compilation ? { compilation: true } : {}),
        };
        n++;
        if (best) picked++;
      }),
    );
  }
  // works whose search found nothing usable are recorded as such, so they are not exported again
  for (const w of works) if (!out[String(w.id)] && existsSync(join(CACHE, `${w.id}.json`)) && !candidates(w).length) out[String(w.id)] = { confidence: "none", reason: "no usable candidates", video: null, alternates: [], maxViews: 0 };
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  console.log(`applied ${n} judgements, ${picked} with an embeddable video; ${Object.keys(out).length} works recorded in total`);
}

// ── second pass ─────────────────────────────────────────────────────
type Judged = { confidence: string; video: unknown; pass2?: string } & Record<string, unknown>;
const readJudged = (): Record<string, Judged> => (existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {});
const hasVideo = (j?: Judged) => !!j?.video && (j.confidence === "high" || j.confidence === "medium");
const judgeItem = (w: ChamberWork, c: Entry[]) => ({
  id: w.id,
  composer: firstLast(w.composer),
  work: w.title,
  ...(w.aka?.length ? { aka: w.aka } : {}),
  formation: label(w.formation),
  scoring: instrumentList(w.instruments, { alternatives: w.alternatives, optional: w.optional }),
  form: w.form,
  expected_minutes: w.minutes,
  candidates: c.map((e) => ({ id: e.id, title: e.title, channel: e.channel, verified: !!e.channel_is_verified, minutes: e.duration != null ? Math.round(e.duration / 60) : null, views: e.view_count })),
});

function exportChunks2() {
  mkdirSync(join(DIR, "to-judge"), { recursive: true });
  const judged = readJudged();
  const files = readdirSync(join(DIR, "to-judge")).filter((f) => /^k\d+\.json$/.test(f));
  const exported = new Set(files.flatMap((f) => (JSON.parse(readFileSync(join(DIR, "to-judge", f), "utf8")).items as { id: number }[]).map((it) => String(it.id))));
  // a set's size and total length tell a judge whether an upload of "the set" can hold it all
  const sets = new Map<string, ChamberWork[]>();
  for (const w of works) if (w.set) sets.set(setKey(w), [...(sets.get(setKey(w)) ?? []), w]);
  const items: unknown[] = [];
  let none = 0;
  let notCollected = 0;
  for (const w of works) {
    const j = judged[String(w.id)];
    if (hasVideo(j) || j?.pass2 || exported.has(String(w.id))) continue;
    if (!existsSync(join(CACHE2, `${w.id}.json`))) {
      notCollected++;
      continue;
    }
    const c = candidates2(w);
    if (!c.length) {
      none++;
      continue;
    }
    const members = w.set ? (sets.get(setKey(w)) ?? []) : [];
    const minutes = members.map((m) => m.minutes);
    items.push({
      ...judgeItem(w, c),
      ...(w.set ? { set: w.set, set_works: members.length, set_minutes: minutes.every((m) => m != null) ? minutes.reduce((a, b) => a! + b!, 0) : null } : {}),
    });
  }
  const full = Math.floor(items.length / CHUNK);
  const n = notCollected ? full : Math.ceil(items.length / CHUNK);
  for (let i = 0; i < n; i++) {
    const name = `k${String(files.length + i + 1).padStart(3, "0")}`;
    writeFileSync(join(DIR, "to-judge", `${name}.json`), JSON.stringify({ chunk: name, items: items.slice(i * CHUNK, (i + 1) * CHUNK) }, null, 1) + "\n");
  }
  console.log(`exported ${Math.min(items.length, n * CHUNK)} works in ${n} new chunks; ${items.length - Math.min(items.length, n * CHUNK)} held back; ${none} without new usable candidates; ${notCollected} not searched yet`);
}

async function apply2() {
  const out = readJudged();
  const byId = new Map(works.map((w) => [String(w.id), w]));
  const files = readdirSync(join(DIR, "choices")).filter((f) => /^k\d+\.json$/.test(f)).sort();
  const jobs: [string, Choice][] = [];
  for (const f of files)
    for (const [id, ch] of Object.entries(JSON.parse(readFileSync(join(DIR, "choices", f), "utf8")) as Record<string, Choice>))
      if (byId.has(id) && !hasVideo(out[id]) && !out[id]?.pass2) jobs.push([id, ch]);
  let picked = 0;
  for (let i = 0; i < jobs.length; i += 6) {
    await Promise.all(
      jobs.slice(i, i + 6).map(async ([id, ch]) => {
        const cands = candidates2(byId.get(id)!);
        const meta = (v: string) => cands.find((e) => e.id === v);
        const ids = [ch.choice, ...(ch.alternates ?? [])].filter((v) => v && v !== "none" && meta(v));
        const ok: string[] = [];
        if (ch.choice !== "none" && ch.confidence !== "low") for (const v of ids) if (await embeddable(v)) ok.push(v);
        const best = ok[0] ? meta(ok[0])! : null;
        if (best) {
          out[id] = {
            confidence: ch.confidence,
            reason: ch.reason ?? "",
            video: { id: best.id, title: best.title, channel: best.channel, seconds: best.duration, views: best.view_count },
            alternates: ok.slice(1),
            maxViews: Math.max(0, ...cands.filter((e) => ids.includes(e.id)).map((e) => e.view_count ?? 0)),
            ...(ch.compilation ? { compilation: true } : {}),
            pass2: "picked",
          };
          picked++;
        } else out[id] = { ...(out[id] ?? { confidence: "none", video: null, alternates: [], maxViews: 0 }), pass2: ch.choice === "none" ? "none" : "low or not embeddable" };
      }),
    );
  }
  // searched again but nothing new to judge: recorded, so the work is not exported again
  let empty = 0;
  for (const w of works) {
    const j = out[String(w.id)];
    if (!hasVideo(j) && !j?.pass2 && existsSync(join(CACHE2, `${w.id}.json`)) && !candidates2(w).length) {
      out[String(w.id)] = { ...(j ?? { confidence: "none", video: null, alternates: [], maxViews: 0 }), pass2: "no new candidates" };
      empty++;
    }
  }
  writeFileSync(OUT, JSON.stringify(out, null, 1) + "\n");
  console.log(`second pass: applied ${jobs.length} judgements, ${picked} new videos; ${empty} works had no new candidates`);
}

const cmd = process.argv[2];
if (cmd === "export") exportChunks();
else if (cmd === "apply") apply();
else if (cmd === "export2") exportChunks2();
else if (cmd === "apply2") apply2();
else throw new Error("usage: recordings.ts export|apply|export2|apply2");
