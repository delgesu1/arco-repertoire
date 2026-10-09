/**
 * Shared helpers for the catalogue-expansion scripts (data/expansion, scripts/expand/*).
 * Run scripts with:  npx tsx --env-file=.env.local scripts/expand/<name>.ts
 */
import Anthropic from "@anthropic-ai/sdk";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const ROOT = join(__dirname, "..", "..");
export const read = <T = any>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
export const write = (p: string, v: unknown) => {
  const f = join(ROOT, p);
  mkdirSync(join(f, ".."), { recursive: true });
  writeFileSync(f, typeof v === "string" ? v : JSON.stringify(v, null, 1));
};
export const exists = (p: string) => existsSync(join(ROOT, p));

// ---------------------------------------------------------------- sheet snapshot
export interface Row {
  rowIndex: number; // 0-based index in sheet.values (header = 0)
  composer: string;
  title: string;
  level: number;
  category: string;
  acc: string;
  era: string;
  dates: string;
  nat: string;
  gender: string;
  min: string;
  notes: string;
  exams: string;
  id: number;
  set: string;
}
export const HEADER = [
  "Composer", "Title", "Level (1–10)", "Category", "Accompaniment", "Era", "Dates", "Nationality", "Composer gender", "Level guide",
  "Approx. min", "Notes / teaching focus", "Exam & syllabus lists", "Listen", "Score", "My notes", "ID", "Set", "Character", "Popularity", "Recording override",
];
export function loadRows(file = "data/source/all-repertoire.json"): { header: string[]; values: string[][]; rows: Row[] } {
  const values: string[][] = read(file).values;
  const h = values[0];
  const ix = (n: string) => h.indexOf(n);
  const rows = values.slice(1).map((r, i): Row => {
    const g = (n: string) => (r[ix(n)] ?? "").toString().trim();
    return {
      rowIndex: i + 1,
      composer: g("Composer"), title: g("Title"), level: Number(g("Level (1–10)")), category: g("Category"), acc: g("Accompaniment"),
      era: g("Era"), dates: g("Dates"), nat: g("Nationality"), gender: g("Composer gender"), min: g("Approx. min"),
      notes: g("Notes / teaching focus"), exams: g("Exam & syllabus lists"), id: Number(g("ID")), set: g("Set"),
    };
  });
  return { header: h, values, rows };
}

export const CATEGORIES = [
  "Concerto", "Concert Piece (orch.)", "Virtuoso Showpiece", "Sonata / Duo (vln & pno)", "Suite / Set", "Short Piece", "Solo Violin",
  "Études & Caprices", "Technique & Scales", "Duet / Double Concerto",
] as const;

/** accompaniment values the model may choose from (all exist in data/accompaniment-map.json) */
export const ACCOMPANIMENTS = [
  "Piano", "Orchestra (piano reduction)", "Unaccompanied", "Continuo", "Harpsichord or piano", "2 violins", "Guitar",
  "String orchestra (piano reduction)", "2 violins & orchestra", "2 violins & piano", "Orchestra or piano", "Piano or orchestra",
  "Violin & viola", "Violin & cello", "2 violins & continuo", "Piano or organ", "Guitar or piano", "3 violins & orchestra",
  "Violin, piano & orchestra", "Strings", "Harp", "Organ",
] as const;

export const slug = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------- Claude calls with a spend ledger
const PRICES: Record<string, { in: number; out: number; cacheWrite: number; cacheRead: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheWrite: 5, cacheRead: 0.4 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheWrite: 2.5, cacheRead: 0.2 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cacheWrite: 0.125, cacheRead: 0.01 },
};
const LEDGER = "data/cache/expansion-spend.jsonl";
export function spentSoFar(): number {
  if (!exists(LEDGER)) return 0;
  return readFileSync(join(ROOT, LEDGER), "utf8")
    .split("\n")
    .filter(Boolean)
    .reduce((s, l) => s + (JSON.parse(l).cost as number), 0);
}
export const BUDGET = Number(process.env.EXPANSION_BUDGET ?? 50);

let client: Anthropic | null = null;
export function claude() {
  return (client ??= new Anthropic({ maxRetries: 6 }));
}

export interface AskOpts {
  label: string;
  model?: string;
  system: string; // cached
  user: string;
  schema: object;
  effort?: "low" | "medium" | "high" | "xhigh";
  maxTokens?: number;
}
export async function ask<T = any>(o: AskOpts): Promise<T> {
  const model = o.model ?? "claude-opus-5-5";
  if (spentSoFar() > BUDGET) throw new Error(`budget of $${BUDGET} exhausted (spent $${spentSoFar().toFixed(2)})`);
  const msg = await claude()
    .messages.stream({
      model,
      max_tokens: o.maxTokens ?? 32000,
      system: [{ type: "text", text: o.system, cache_control: { type: "ephemeral" } }],
      output_config: { effort: o.effort ?? "medium", format: { type: "json_schema", schema: o.schema as any } },
      messages: [{ role: "user", content: o.user }],
    })
    .finalMessage();
  const u = msg.usage as any;
  const p = PRICES[model];
  const cost =
    (((u.input_tokens ?? 0) * p.in + (u.output_tokens ?? 0) * p.out + (u.cache_creation_input_tokens ?? 0) * p.cacheWrite + (u.cache_read_input_tokens ?? 0) * p.cacheRead) /
      1e6);
  mkdirSync(join(ROOT, "data/cache"), { recursive: true });
  appendFileSync(
    join(ROOT, LEDGER),
    JSON.stringify({ t: new Date().toISOString(), label: o.label, model, in: u.input_tokens, out: u.output_tokens, cw: u.cache_creation_input_tokens, cr: u.cache_read_input_tokens, cost }) + "\n",
  );
  const text = msg.content.find((b) => b.type === "text");
  if (msg.stop_reason !== "end_turn" || !text || text.type !== "text") throw new Error(`${o.label}: stop_reason ${msg.stop_reason}`);
  return JSON.parse(text.text) as T;
}

/** run async jobs with a concurrency limit */
export async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      for (let i = next++; i < items.length; i = next++) out[i] = await fn(items[i], i);
    }),
  );
  return out;
}

// ---------------------------------------------------------------- level anchors
/** a spread of existing, well-evidenced rows across all levels, so the model calibrates to this scale */
export function anchorLines(rows: Row[], perLevel = 24): string {
  const out: string[] = [];
  for (let lv = 1; lv <= 10; lv++) {
    const pool_ = rows.filter((r) => r.level === lv);
    // prefer rows with exam evidence, then spread over composers and categories
    const scored = pool_
      .map((r) => ({ r, s: (r.exams ? 2 : 0) + (r.notes ? 0.5 : 0) + hash(`${r.id}`) }))
      .sort((a, b) => b.s - a.s);
    const perComposer = new Map<string, number>();
    const perCat = new Map<string, number>();
    const pick: Row[] = [];
    for (const { r } of scored) {
      if ((perComposer.get(r.composer) ?? 0) >= 2 || (perCat.get(r.category) ?? 0) >= Math.ceil(perLevel / 3)) continue;
      pick.push(r);
      perComposer.set(r.composer, (perComposer.get(r.composer) ?? 0) + 1);
      perCat.set(r.category, (perCat.get(r.category) ?? 0) + 1);
      if (pick.length >= perLevel) break;
    }
    out.push(`## Level ${lv}`);
    for (const r of pick.sort((a, b) => a.composer.localeCompare(b.composer))) {
      out.push(`${r.composer.split(",")[0]}: ${r.title} [${r.category}${r.min ? `, ${r.min} min` : ""}]${r.exams ? ` {${r.exams.slice(0, 60)}}` : ""}`);
    }
  }
  return out.join("\n");
}
function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1000;
  return h / 1000; // 0..1 tie-breaker
}

export const existingLine = (r: Row) =>
  `${r.id}|${r.title}|L${r.level}|${r.category}|${r.acc}|${r.min || "?"}min${r.set ? `|set: ${r.set}` : ""}`;
