/**
 * Writes docs/catalogue-expansion-2026-10.md: what the expansion added, changed, merged and dropped.
 *
 *   npx tsx scripts/expand/report.ts          (after `merge.ts --write`; reads data/expansion/final/*.json and both snapshots)
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, read, loadRows } from "./common";

const before = loadRows("data/cache/all-repertoire.before-expansion.json" as string);
const afterFile = existsSync(join(ROOT, "data/expansion/final/all-repertoire.next.json")) ? "data/expansion/final/all-repertoire.next.json" : "data/source/all-repertoire.json";
const after = loadRows(afterFile);
const added: any[] = read("data/expansion/final/added.json");
const changes: any[] = read("data/expansion/final/changes.json");
const merges: any[] = read("data/expansion/final/merges.json");
const dropped: any[] = read("data/expansion/final/dropped.json");
const targets: string[] = read("data/expansion/target-composers-sheet-names.json");

const count = (rows: { composer: string }[], c: string) => rows.filter((r) => r.composer === c).length;
const lines: string[] = [];
const L = (s = "") => lines.push(s);

L("# Catalogue expansion, October 2026");
L();
L(`The catalogue grew from **${before.rows.length}** to **${after.rows.length}** works. This note records what changed for the ${targets.length} composers Daniel listed and how.`);
L();
L("## How it was done");
L("- **Work lists** come from IMSLP: every work page of each composer was read through the IMSLP API, together with its instrumentation categories and, for violin-relevant pages, the work-info block (key, year, movements, average duration, arrangements).");
L("- **Scope:** violin as soloist or duo partner (with orchestra, piano, keyboard/continuo, guitar or harp; unaccompanied; two or three violins; violin with viola or cello; double and triple concertos where the violin is a principal soloist), plus *established* arrangements by notable violinists that are published and recorded. Chamber music, orchestral/vocal works, fragments, spurious or unpublished works, method-book arrangements and beginner pieces below the catalogue's range are left out.");
L("- Each IMSLP item was matched against the existing entries (so nothing is added twice), turned into a catalogue entry in the house style, and graded 1–10 against the existing scale (calibration anchors from the Sheet, the composer's own entries, and a second blind grading by a different model; the two were blended).");
L("- Works IMSLP does not host (twentieth-century composers, copyright) and established arrangements were proposed from knowledge, then checked against Wikipedia, publisher and library catalogues by separate web-research agents, which also looked for gaps. Entries they could not confirm were dropped; collection pieces whose individual titles could not be confirmed were collapsed into the collection.");
L("- Existing entries of these composers were audited: demonstrable errors (catalogue numbers, keys, categories, accompaniment, durations, set membership) were corrected, near-duplicates merged, and levels changed only where the evidence was clear.");
L();
L("## Per composer");
L();
L("| Composer | Before | After | Added |");
L("|---|---:|---:|---:|");
for (const c of targets) {
  const b = count(before.rows, c), a = count(after.rows, c);
  L(`| ${c} | ${b} | ${a} | ${a - b >= 0 ? "+" : ""}${a - b} |`);
}
L();
L(`Total for these composers: ${targets.reduce((n, c) => n + count(before.rows, c), 0)} → ${targets.reduce((n, c) => n + count(after.rows, c), 0)}.`);
L();
const lv = changes.filter((c) => c.field === "level" && c.applied);
L(`## Levels changed on existing entries (${lv.length})`);
L();
L("| Composer | Piece | Was | Now | Why |");
L("|---|---|---:|---:|---|");
for (const c of lv) L(`| ${c.composer.split(",")[0]} | ${c.title} | ${c.before} | ${c.after} | ${String(c.reason).replace(/\|/g, "/")} |`);
L();
const fx = changes.filter((c) => c.field !== "level" && c.applied);
L(`## Other corrections to existing entries (${fx.length})`);
L();
L("Catalogue numbers, titles, set membership, accompaniment, category and missing durations, each backed by IMSLP data or a source the checker named.");
L();
L("| Composer | Piece | Field | Was | Now |");
L("|---|---|---|---|---|");
for (const c of fx) L(`| ${c.composer.split(",")[0]} | ${c.title} | ${c.field} | ${String(c.before ?? "").replace(/\|/g, "/")} | ${String(c.after).replace(/\|/g, "/")} |`);
L();
L(`## Merged duplicates (${merges.length})`);
for (const m of merges) L(`- id ${m.remove} merged into ${m.keep}: ${m.reason} (the old address redirects)`);
L();
L(`## Proposed but not added (${dropped.length})`);
L();
for (const d of dropped) L(`- ${d.composer.split(",")[0]}: ${d.title || d.uid} — ${d.why}`);
L();
L("## Caveats");
L("- Levels for the long tail (obscure salon pieces, minor Baroque concertos) are estimates: two models graded each work independently against the composer's other works and the scale (the grades were averaged; disagreements of two or more levels are listed in `data/expansion/final/level-disagreements.json`), neither with first-hand knowledge of every piece. They are not marked on the site.");
L("- Recordings for new works are matched by the same automatic search-and-judge pipeline as before; works with no confident match show a YouTube search link.");
L("- New entries start with no exam listings. Character tags and the well-known / lesser-known rating were generated for them by the same method as for the original entries; many obscure works have only the tags that follow from the title (key, form).");
L("- The gap checks by the web researchers were thorough for most composers but partial for Brahms, Bruch, Cui, Elgar, Franck, Massenet, Mendelssohn, Saint-Saëns, Schubert, Schumann, Schütt, Scott and Sinding (the shared web-search quota ran out; they relied on IMSLP and Wikipedia work lists). Missing works found later can be added the same way: `scripts/expand/` documents the passes.");
L("- The advisor's prompt lists the best-known and most-taught works of each composer rather than all of them (its price rises steeply above 100,000 tokens). The rest of the catalogue is reachable for the advisor through its search tool.");
mkdirSync(join(ROOT, "docs"), { recursive: true });
writeFileSync(join(ROOT, "docs/catalogue-expansion-2026-10.md"), lines.join("\n") + "\n");
console.log(`wrote docs/catalogue-expansion-2026-10.md (${lines.length} lines)`);
void added;
