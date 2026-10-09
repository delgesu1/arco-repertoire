/**
 * Builds data/expansion/review/<slug>.json for the web-verification step:
 * the composer's existing entries, the queued additions (pass 1 + pass 2) with stable ids N1…Nk, and which of them
 * are NOT fully supported by the IMSLP page data (so somebody must check them against a source).
 *
 *   npx tsx scripts/expand/build_review.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, loadRows, read, slug, write } from "./common";

const { rows } = loadRows();
const targets: string[] = read("data/expansion/target-composers-sheet-names.json");

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/ł/g, "l").toLowerCase();
const toks = (s: string) => fold(s).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
const GENERIC = new Set(
  `in major minor no nos op opus from after for and the of a an de la le les du des et en sur on to with by or version transcription
   violin violins piano orchestra complete arr arranged solo duo pieces piece nr n e i ii iii iv v vi vii viii ix x
   flat sharp sonata concerto suite set book vol part parts movement mov d dur moll g s h l m b c f k wq wo woo`.split(/\s+/),
);

function wikiFor(pageid: number) {
  const f = join(ROOT, "data/cache/imslp-wiki", `${pageid}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}

function unsupportedTokens(entryTitle: string, pageTitle: string, pageid: number, arranger: string): string[] {
  const w = wikiFor(pageid);
  const i = w?.info ?? {};
  const allowed = new Set<string>([
    ...toks(pageTitle.replace(/\([^()]*\)\s*$/, "")),
    ...toks(i["Alternative Title"] ?? ""),
    ...toks(i["Work Title"] ?? ""),
    ...toks((i["Number of Movements/Sections"] ?? "").replace(/level=\d+\|number=\d+\|title=/g, " ")),
    ...toks(i["Opus/Catalogue Number"] ?? ""),
    ...toks(arranger),
    ...toks((w?.arrs ?? []).map((a: any) => a.heading).join(" ")),
  ]);
  return toks(entryTitle).filter((t) => !/^\d+$/.test(t) && t.length > 1 && !GENERIC.has(t) && !allowed.has(t));
}

for (const composer of targets) {
  const f1 = `data/expansion/pass1/${slug(composer)}.json`;
  const f2 = `data/expansion/pass2/${slug(composer)}.json`;
  const p1 = existsSync(join(ROOT, f1)) ? read(f1) : { decisions: [] };
  const p2 = existsSync(join(ROOT, f2)) ? read(f2) : { missing: [] };
  const mine = rows.filter((r) => r.composer === composer);
  const queued: any[] = [];
  for (const d of p1.decisions) {
    for (const e of d.entries) {
      const unsupported = unsupportedTokens(e.title, d.page, d.pageid, e.arranger);
      queued.push({ ...e, source: "imslp", imslp_page: d.page, pageid: d.pageid, unsupported, verify: unsupported.length > 0 || d.entries.length > 1 && !wikiFor(d.pageid)?.info?.["Number of Movements/Sections"] });
    }
  }
  for (const e of p2.missing) queued.push({ ...e, source: "knowledge", imslp_page: "", pageid: 0, unsupported: [], verify: true });
  queued.forEach((q, i) => (q.uid = `N${i + 1}`));
  write(`data/expansion/review/${slug(composer)}.json`, {
    composer,
    existing: mine.map((r) => ({ id: r.id, title: r.title, level: r.level, category: r.category, accompaniment: r.acc, minutes: r.min, set: r.set })),
    queued,
  });
  const v = queued.filter((q) => q.verify).length;
  console.log(`${composer.padEnd(32)} existing ${String(mine.length).padStart(3)}  queued ${String(queued.length).padStart(3)}  need verification ${String(v).padStart(3)} (${queued.filter((q) => q.source === "knowledge").length} from knowledge)`);
}
