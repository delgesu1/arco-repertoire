/**
 * Phase 5: applies the fact-check agents' results (data/chamber/verify/checked/*.json) to data/chamber/works.json.
 *
 *   npx tsx scripts/chamber/verify_apply.ts --dry   # print every change, reject and doubt; write nothing
 *   npx tsx scripts/chamber/verify_apply.ts [chunk …]   # apply (all files in checked/, or only the chunks named)
 *
 * "fixed": the corrected fields replace the old ones (only facts: never level, hardest part, popularity or tags);
 * a changed scoring recomputes players and, unless a formationNote explains it, the formation.
 * "reject": the work leaves works.json and goes to data/chamber/verify/rejected.json with its reason (its id stays
 * reserved in id-registry.json). "doubt": listed in data/chamber/verify/doubts.json for the owner; the entry is unchanged,
 * and a later verdict for the same work (files are read in name order, the owner's zz-owner.json last) closes the doubt.
 * Order of the pipeline: merge_curation.ts → grading_apply.ts → verify_apply.ts (each can be re-run from its files).
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberWork, InstrumentKey } from "../../lib/chamber/types";
import { formationFor, playersFor } from "../../lib/chamber/vocab";

const ROOT = join(__dirname, "..", "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const dry = process.argv.includes("--dry");
const only = process.argv.slice(2).filter((a) => !a.startsWith("--")); // chunk names; default: every file in checked/
const FIELDS = new Set(["composer", "title", "aka", "formation", "formationNote", "instruments", "alternatives", "optional", "players", "form", "year", "minutes", "set", "notes", "imslpPage"]);

interface Result {
  id: number;
  verdict: "confirmed" | "fixed" | "doubt" | "reject";
  reason?: string;
  fixes?: Record<string, unknown>;
  sources?: string[];
  note?: string;
}

/**
 * A corrected scoring can remove the instrument the hardest part names (cellos that were viols). When exactly one
 * instrument was swapped for another, the hardest part follows it ("cello 1" -> "viola-da-gamba 1"); otherwise it
 * becomes "balanced" (phase 4's graders chose it for the old scoring).
 */
function remapHardest(hardest: string, before: Partial<Record<InstrumentKey, number>>, after: Partial<Record<InstrumentKey, number>>): string {
  if (hardest === "balanced") return hardest;
  const m = hardest.match(/^([a-z-]+?)(?: (\d))?$/);
  const key = m?.[1] as InstrumentKey | undefined;
  const num = m?.[2];
  if (key && after[key] && (!num || Number(num) <= after[key]!)) return after[key]! > 1 && !num ? `${key} 1` : after[key] === 1 && num ? key : hardest;
  const removed = (Object.keys(before) as InstrumentKey[]).filter((k) => !after[k]);
  const added = (Object.keys(after) as InstrumentKey[]).filter((k) => !before[k]);
  if (key && removed.length === 1 && removed[0] === key && added.length === 1) {
    const n = after[added[0]]!;
    return n > 1 ? `${added[0]} ${Math.min(Number(num ?? 1), n)}` : added[0];
  }
  return "balanced";
}

const works = read<ChamberWork[]>("data/chamber/works.json");
const byId = new Map(works.map((w) => [w.id, w]));
const dir = "data/chamber/verify/checked";
const counts: Record<string, number> = {};
type Rejected = ChamberWork & { rejectReason: string; rejectNote: string; rejectSources: string[]; chunk: string };
// works rejected by an earlier run are no longer in works.json: keep their records, so the script can be re-run
const rejectedPath = "data/chamber/verify/rejected.json";
const rejectedById = new Map<number, Rejected>(existsSync(join(ROOT, rejectedPath)) ? read<Rejected[]>(rejectedPath).map((r) => [r.id, r]) : []);
// a doubt stays open until a later file (data/chamber/verify/checked/zz-owner.json: the owner's decisions) gives the work another verdict
const doubts = new Map<number, { id: number; title: string; composer: string; note: string; sources: string[]; chunk: string }>();
const fieldCounts: Record<string, number> = {};
const lines: string[] = [];
const fmt = (v: unknown) => (typeof v === "string" ? v : JSON.stringify(v));

for (const f of readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(".json")).sort()) {
  const chunk = f.replace(".json", "");
  if (only.length && !only.includes(chunk)) continue;
  for (const r of read<{ results: Result[] }>(`${dir}/${f}`).results) {
    counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
    const w = byId.get(r.id);
    if (!w) {
      if (!rejectedById.has(r.id)) lines.push(`! ${chunk}: id ${r.id} is not in works.json`); // a work a later file rejected is expected here
      doubts.delete(r.id);
      continue;
    }
    if (w.benchmark || w.violinId) {
      lines.push(`! ${chunk}: ${r.id} is a benchmark or violin work; result ignored`);
      continue;
    }
    const head = `${r.id} ${w.composer.split(",")[0]}: ${w.title}`;
    if (r.verdict === "doubt") doubts.set(r.id, { id: r.id, title: w.title, composer: w.composer, note: r.note ?? "", sources: r.sources ?? [], chunk });
    else doubts.delete(r.id);
    if (r.verdict === "reject") {
      lines.push(`x ${head} — ${r.reason}${r.note ? ` (${r.note})` : ""}`);
      rejectedById.set(r.id, { ...w, rejectReason: r.reason ?? "", rejectNote: r.note ?? "", rejectSources: r.sources ?? [], chunk });
      byId.delete(r.id);
      continue;
    }
    if (r.verdict !== "fixed") continue;
    lines.push(`* ${head}${r.note ? ` (${r.note})` : ""}`);
    const oldInstruments = { ...w.instruments };
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
      const fixed = remapHardest(w.hardestPart, oldInstruments, w.instruments);
      if (fixed !== w.hardestPart) {
        lines.push(`    hardestPart: ${w.hardestPart} -> ${fixed} (follows the scoring)`);
        w.hardestPart = fixed;
      }
    }
  }
}

for (const l of lines) console.log(l);
console.log(
  `\n${JSON.stringify(counts)}; fields fixed: ${Object.entries(fieldCounts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(", ") || "none"}; ` +
    `rejects by reason: ${JSON.stringify([...rejectedById.values()].reduce<Record<string, number>>((m, r) => ((m[r.rejectReason.replace(/ \d+$/, "")] = (m[r.rejectReason.replace(/ \d+$/, "")] ?? 0) + 1), m), {}))}`,
);
if (!dry) {
  writeFileSync(join(ROOT, "data/chamber/works.json"), JSON.stringify([...byId.values()], null, 1) + "\n");
  writeFileSync(join(ROOT, rejectedPath), JSON.stringify([...rejectedById.values()].sort((a, b) => a.id - b.id), null, 1) + "\n");
  writeFileSync(join(ROOT, "data/chamber/verify/doubts.json"), JSON.stringify([...doubts.values()], null, 1) + "\n");
}
