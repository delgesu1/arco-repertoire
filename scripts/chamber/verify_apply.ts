/**
 * Phase 5: applies the fact-check agents' results (data/chamber/verify/checked/*.json) to data/chamber/works.json.
 *
 *   npx tsx scripts/chamber/verify_apply.ts --dry   # print every change, reject and doubt; write nothing
 *   npx tsx scripts/chamber/verify_apply.ts         # apply
 *
 * "fixed": the corrected fields replace the old ones (only facts: never level, hardest part, popularity or tags);
 * a changed scoring recomputes players and, unless a formationNote explains it, the formation.
 * "reject": the work leaves works.json and goes to data/chamber/verify/rejected.json with its reason (its id stays
 * reserved in id-registry.json). "doubt": listed in data/chamber/verify/doubts.json for the owner; the entry is unchanged.
 * Order of the pipeline: merge_curation.ts → grading_apply.ts → verify_apply.ts (each can be re-run from its files).
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberWork, InstrumentKey } from "../../lib/chamber/types";
import { formationFor, playersFor } from "../../lib/chamber/vocab";

const ROOT = join(__dirname, "..", "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const dry = process.argv.includes("--dry");
const FIELDS = new Set(["composer", "title", "aka", "formation", "formationNote", "instruments", "alternatives", "optional", "players", "form", "year", "minutes", "set", "notes", "imslpPage"]);

interface Result {
  id: number;
  verdict: "confirmed" | "fixed" | "doubt" | "reject";
  reason?: string;
  fixes?: Record<string, unknown>;
  sources?: string[];
  note?: string;
}

const works = read<ChamberWork[]>("data/chamber/works.json");
const byId = new Map(works.map((w) => [w.id, w]));
const dir = "data/chamber/verify/checked";
const counts: Record<string, number> = {};
const rejected: (ChamberWork & { rejectReason: string; rejectNote: string; rejectSources: string[]; chunk: string })[] = [];
const doubts: { id: number; title: string; composer: string; note: string; sources: string[]; chunk: string }[] = [];
const fieldCounts: Record<string, number> = {};
const lines: string[] = [];
const fmt = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

for (const f of readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".json")).sort()) {
  const chunk = f.replace(".json", "");
  for (const r of read<{ results: Result[] }>(`${dir}/${f}`).results) {
    counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
    const w = byId.get(r.id);
    if (!w) {
      lines.push(`! ${chunk}: id ${r.id} is not in works.json (already rejected?)`);
      continue;
    }
    if (w.benchmark || w.violinId) {
      lines.push(`! ${chunk}: ${r.id} is a benchmark or violin work; result ignored`);
      continue;
    }
    const head = `${r.id} ${w.composer.split(",")[0]}: ${w.title}`;
    if (r.verdict === "doubt") doubts.push({ id: r.id, title: w.title, composer: w.composer, note: r.note ?? "", sources: r.sources ?? [], chunk });
    if (r.verdict === "reject") {
      lines.push(`x ${head} — ${r.reason}${r.note ? ` (${r.note})` : ""}`);
      rejected.push({ ...w, rejectReason: r.reason ?? "", rejectNote: r.note ?? "", rejectSources: r.sources ?? [], chunk });
      byId.delete(r.id);
      continue;
    }
    if (r.verdict !== "fixed") continue;
    lines.push(`* ${head}${r.note ? ` (${r.note})` : ""}`);
    for (const [k, v] of Object.entries(r.fixes ?? {})) {
      if (!FIELDS.has(k)) {
        lines.push(`    skipped ${k}: not a field the check may change`);
        continue;
      }
      fieldCounts[k] = (fieldCounts[k] ?? 0) + 1;
      lines.push(`    ${k}: ${fmt((w as unknown as Record<string, unknown>)[k])} -> ${fmt(v)}`);
      const empty = v === null || v === "" || (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0) || (Array.isArray(v) && v.length === 0);
      if (empty && ["aka", "alternatives", "optional", "formationNote", "imslpPage"].includes(k)) delete (w as unknown as Record<string, unknown>)[k];
      else (w as unknown as Record<string, unknown>)[k] = v;
    }
    if (r.fixes && "instruments" in r.fixes) {
      w.players = playersFor(w.instruments as Partial<Record<InstrumentKey, number>>);
      if (!w.formationNote) w.formation = formationFor(w.instruments);
    }
  }
}

for (const l of lines) console.log(l);
console.log(
  `\n${JSON.stringify(counts)}; fields fixed: ${Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}; ` +
    `rejects by reason: ${JSON.stringify(rejected.reduce<Record<string, number>>((m, r) => ((m[r.rejectReason.replace(/ \d+$/, "")] = (m[r.rejectReason.replace(/ \d+$/, "")] ?? 0) + 1), m), {}))}`,
);
if (!dry) {
  writeFileSync(join(ROOT, "data/chamber/works.json"), JSON.stringify([...byId.values()], null, 1) + "\n");
  writeFileSync(join(ROOT, "data/chamber/verify/rejected.json"), JSON.stringify(rejected, null, 1) + "\n");
  writeFileSync(join(ROOT, "data/chamber/verify/doubts.json"), JSON.stringify(doubts, null, 1) + "\n");
}
