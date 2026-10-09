/**
 * Writes the generated Character / Popularity text into the NEW rows of the next snapshot, the way the Sheet's S / T
 * columns hold them (S = "<mode>, <pace>, <character…>", T = Well-known / Lesser-known), using the values the build computes.
 *
 *   PREVIEW=1 SNAPSHOT=data/expansion/final/all-repertoire.next.json npx tsx scripts/build-data.ts
 *   npx tsx scripts/expand/fill_tags.ts          (reads data/expansion/preview/catalogue.json, edits the next snapshot in place)
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SNAP = join(ROOT, "data/expansion/final/all-repertoire.next.json");
const snap = JSON.parse(readFileSync(SNAP, "utf8"));
const cat = JSON.parse(readFileSync(join(ROOT, "data/expansion/preview/catalogue.json"), "utf8"));
const byId = new Map<number, any>(cat.pieces.map((p: any) => [p.id, p]));
const h: string[] = snap.values[0];
const I = { id: h.indexOf("ID"), ch: h.indexOf("Character"), pop: h.indexOf("Popularity") };
const ORIGINAL_MAX = 2253;
let n = 0;
for (const row of snap.values.slice(1)) {
  const id = Number(row[I.id]);
  if (id <= ORIGINAL_MAX) continue;
  const p = byId.get(id);
  if (!p) throw new Error(`no piece ${id} in the preview catalogue`);
  row[I.ch] = [p.mode, p.pace, ...p.character].filter(Boolean).join(", ");
  row[I.pop] = p.popularity === "well-known" ? "Well-known" : p.popularity === "lesser-known" ? "Lesser-known" : "";
  n++;
}
writeFileSync(SNAP, JSON.stringify(snap));
console.log(`filled Character/Popularity for ${n} new rows`);
