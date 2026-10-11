/**
 * Checks the IMSLP links of the built catalogue.
 *
 *   npx tsx scripts/check-imslp.ts            coverage report only (offline)
 *   npx tsx scripts/check-imslp.ts --live     also asks IMSLP whether every linked page exists, and fetches a sample of the final URLs
 *
 * Exits non-zero when a linked page does not exist, so it can guard a catalogue expansion.
 * Pieces without `imslpPage` get no IMSLP link on the site (there is no search fallback).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalogue } from "../lib/types";

const ROOT = join(__dirname, "..");
const cat: Catalogue = JSON.parse(readFileSync(join(ROOT, "public/data/catalogue.json"), "utf8"));
const UA = "ArcoRepertoire/1.0 (+https://repertoire.arco.app) link check";
const url = (page: string) => `https://imslp.org/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}`;

const linked = cat.pieces.filter((p) => p.imslpPage);
console.log(`${linked.length} of ${cat.pieces.length} works link to their IMSLP page (${((100 * linked.length) / cat.pieces.length).toFixed(1)}%)`);
const by = (key: (p: (typeof cat.pieces)[number]) => string) => {
  const m = new Map<string, [number, number]>();
  for (const p of cat.pieces) {
    const e = m.get(key(p)) ?? [0, 0];
    e[1]++;
    if (p.imslpPage) e[0]++;
    m.set(key(p), e);
  }
  return [...m.entries()].sort((a, b) => b[1][1] - a[1][1]);
};
for (const [name, [n, t]] of by((p) => p.era)) console.log(`  ${name.padEnd(16)} ${String(n).padStart(5)} / ${String(t).padEnd(5)} ${((100 * n) / t).toFixed(0)}%`);
for (const [name, [n, t]] of by((p) => p.type)) console.log(`  ${name.padEnd(16)} ${String(n).padStart(5)} / ${String(t).padEnd(5)} ${((100 * n) / t).toFixed(0)}%`);

if (process.argv.includes("--live")) {
  (async () => {
    const titles = [...new Set(linked.map((p) => p.imslpPage!))];
    const missing: string[] = [];
    for (let i = 0; i < titles.length; i += 40) {
      const chunk = titles.slice(i, i + 40);
      const res = await fetch(`https://imslp.org/api.php?${new URLSearchParams({ action: "query", titles: chunk.join("|"), redirects: "1", format: "json" })}`, { headers: { "User-Agent": UA } });
      type Q = { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages: Record<string, { title: string; missing?: string }> };
      const q = ((await res.json()) as { query: Q }).query;
      const norm = new Map((q.normalized ?? []).map((n) => [n.from, n.to]));
      const redir = new Map((q.redirects ?? []).map((r) => [r.from, r.to]));
      const gone = new Set(Object.values(q.pages).filter((p) => "missing" in p).map((p) => p.title));
      for (const t of chunk) {
        const n = norm.get(t) ?? t;
        if (gone.has(redir.get(n) ?? n)) missing.push(t);
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    console.log(`checked ${titles.length} distinct page titles: ${missing.length} missing`);
    for (const t of missing) console.log("  MISSING", t);
    // final URLs: every 60th page plus the ones with unusual characters (slashes, apostrophes, ampersands, question marks)
    const odd = titles.filter((t) => /[/?&'’"+#%]/.test(t));
    const sample = [...new Set([...titles.filter((_, i) => i % 60 === 0), ...odd.slice(0, 25)])];
    let bad = 0;
    for (const t of sample) {
      const r = await fetch(url(t), { headers: { "User-Agent": UA }, redirect: "follow" });
      if (!r.ok) {
        bad++;
        console.log(`  HTTP ${r.status}`, url(t));
      }
      await new Promise((r) => setTimeout(r, 700));
    }
    console.log(`fetched ${sample.length} sample URLs: ${bad} failed`);
    process.exit(missing.length || bad ? 1 : 0);
  })();
}
