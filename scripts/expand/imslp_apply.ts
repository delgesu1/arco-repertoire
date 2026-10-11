/**
 * Step 5 of the IMSLP link pass: fold the accepted matches into data/imslp-pages.json.
 *
 *   npx tsx scripts/expand/imslp_apply.ts            dry run: prints the numbers and writes data/expansion/imslp/report.json
 *   npx tsx scripts/expand/imslp_apply.ts --write    also merges into data/imslp-pages.json (existing entries are never changed)
 *
 * Accepted: confidence high or medium, a page chosen from the harvested IMSLP list, and at least one scan on the page.
 * Not accepted (kept in the report for review): low confidence, and pages with no scans (usually stubs for copyrighted works).
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, exists, read, write } from "./common";

const WRITE = process.argv.includes("--write");
const cat: { id: number; composer: string; title: string }[] = read("public/data/catalogue.json").pieces;
const byId = new Map(cat.map((p) => [p.id, p]));
const pages: Record<string, string> = read("data/imslp-pages.json");

const dir = "data/expansion/imslp/matches";
const matches: any[] = readdirSync(join(ROOT, dir))
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => read(`${dir}/${f}`));

// ids the verifier judged to point at a different composition (imslp_verify.ts): never applied, and removed if an earlier run applied them
// plus hand decisions in manual-rejected.json ([{id, reason}]), which a verifier run never overwrites
const rejected = new Set<number>([
  ...(exists("data/expansion/imslp/rejected.json") ? (read("data/expansion/imslp/rejected.json") as number[]) : []),
  ...(exists("data/expansion/imslp/manual-rejected.json") ? (read("data/expansion/imslp/manual-rejected.json") as { id: number }[]).map((r) => r.id) : []),
]);
const retract: string[] = [];
const accepted: Record<string, string> = {};
const lowConfidence: any[] = [];
const noScans: any[] = [];
const noMatch: any[] = [];
for (const m of matches) {
  const p = byId.get(m.id);
  if (!p) continue;
  if (rejected.has(m.id)) {
    if (m.page && pages[String(m.id)] === m.page) retract.push(String(m.id));
    continue;
  }
  if (pages[String(m.id)]) continue; // never overwrite an existing link
  if (!m.page) {
    noMatch.push({ id: m.id, composer: p.composer, title: p.title, note: m.note });
  } else if (m.confidence === "low") {
    lowConfidence.push({ id: m.id, composer: p.composer, title: p.title, page: m.page, note: m.note });
  } else if (m.nfiles === 0) {
    noScans.push({ id: m.id, composer: p.composer, title: p.title, page: m.page });
  } else {
    accepted[String(m.id)] = m.page;
  }
}

const stillUnlinked = cat.filter((p) => (!pages[String(p.id)] || retract.includes(String(p.id))) && !accepted[String(p.id)]);
const report = {
  existing: Object.keys(pages).length,
  accepted: Object.keys(accepted).length,
  rejectedByVerifier: rejected.size,
  retracted: retract.length,
  lowConfidence: lowConfidence.length,
  noScans: noScans.length,
  noMatch: noMatch.length,
  stillUnlinked: stillUnlinked.length,
  of: cat.length,
  lowConfidenceList: lowConfidence,
  noScansList: noScans,
  stillUnlinkedList: stillUnlinked.map((p) => ({ id: p.id, composer: p.composer, title: p.title })),
};
write("data/expansion/imslp/report.json", report);
console.log({ ...report, lowConfidenceList: undefined, noScansList: undefined, stillUnlinkedList: undefined });

if (WRITE) {
  const merged = { ...pages, ...accepted };
  for (const id of retract) delete merged[id];
  const sorted = Object.fromEntries(Object.entries(merged).sort((a, b) => Number(a[0]) - Number(b[0])));
  write("data/imslp-pages.json", JSON.stringify(sorted, null, 1) + "\n");
  console.log(`wrote data/imslp-pages.json: ${Object.keys(sorted).length} entries`);
}
