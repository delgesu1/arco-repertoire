/**
 * Keeps old addresses working after a catalogue change:
 *   data/id-redirects.json    {removedId: "keptId/slug"}          pieces merged into another entry (data/id-merges.json)
 *   data/slug-redirects.json  {"id/oldSlug": "id/newSlug"}        pieces whose title (and so slug) changed (accumulates over expansions)
 * both are read by next.config.ts. The slug map compares the catalogue built now with the one in the last commit
 * (OLD_CATALOGUE=<file> overrides), so run it after build-data and before committing.
 *
 *   npx tsx scripts/expand/redirects.ts
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const cat = JSON.parse(readFileSync(join(ROOT, process.env.CATALOGUE_JSON ?? "data/build/catalogue.json"), "utf8"));
const old = JSON.parse(
  process.env.OLD_CATALOGUE ? readFileSync(process.env.OLD_CATALOGUE, "utf8") : execSync("git show HEAD:data/build/catalogue.json", { cwd: ROOT, maxBuffer: 1 << 28 }).toString(),
);
const merges: Record<string, number> = JSON.parse(readFileSync(join(ROOT, "data/id-merges.json"), "utf8"));
const byId = new Map<number, { slug: string }>(cat.pieces.map((p: any) => [p.id, p]));

const ids: Record<string, string> = {};
for (const [from, to] of Object.entries(merges)) {
  const p = byId.get(to);
  if (!p) throw new Error(`kept piece ${to} is missing from the catalogue`);
  ids[from] = `${to}/${p.slug}`;
}
writeFileSync(join(ROOT, "data/id-redirects.json"), JSON.stringify(ids, null, 2) + "\n");

const slugs: Record<string, string> = {};
for (const o of old.pieces as { id: number; slug: string }[]) {
  const n = byId.get(o.id);
  if (n && n.slug !== o.slug && !(String(o.id) in ids)) slugs[`${o.id}/${o.slug}`] = `${o.id}/${n.slug}`;
}
// keep the redirects of earlier expansions: a regeneration only ever adds (a piece renamed again is pointed at its newest address)
const FILE = join(ROOT, "data/slug-redirects.json");
const prev: Record<string, string> = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
const valid = new Set((cat.pieces as { id: number; slug: string }[]).map((p) => `${p.id}/${p.slug}`));
const all: Record<string, string> = {};
for (const [from, to] of Object.entries(prev)) all[from] = slugs[to] ?? to;
Object.assign(all, slugs);
for (const [from, to] of Object.entries(all)) if (!valid.has(to) || valid.has(from)) delete all[from]; // dead targets and loops
writeFileSync(FILE, JSON.stringify(all, null, 2) + "\n");
console.log(`${Object.keys(ids).length} id redirects, ${Object.keys(all).length} slug redirects (${Object.keys(slugs).length} new in this run)`);
