/**
 * Step 3 of the IMSLP link pass: match catalogue works that have no exact IMSLP page to a work page.
 *
 *   npx tsx --env-file=.env.local scripts/expand/imslp_match.ts [composer substring …] [--redo] [--limit N]
 *
 * Reads   public/data/catalogue.json                    (works without imslpPage)
 *         data/cache/imslp-all/resolve.json + pages/    (from imslp_resolve.py / imslp_harvest_all.py)
 * Writes  data/expansion/imslp/matches/<composer slug>.json   [{id, page|null, confidence, kind, note}]
 *
 * Per composer: a deterministic shortlist (catalogue numbers + title words + violin instrumentation) goes to the model
 * in one call with all of the composer's unlinked works. The model may only answer with a candidate it was shown.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { ROOT, ask, exists, pool, read, slug, spentSoFar, write } from "./common";

interface IPage {
  title: string;
  pageid: number;
  info: Record<string, string>;
  nfiles: number;
  arrs: { heading: string; arrangers: string[]; nfiles: number }[];
  cats: string[];
}
interface Piece {
  id: number;
  composer: string;
  title: string;
  type: string;
  accompaniment: string;
  imslpPage?: string;
  set: string | null;
}

const args = process.argv.slice(2);
const redo = args.includes("--redo");
const limitIx = args.indexOf("--limit");
const limit = limitIx >= 0 ? Number(args[limitIx + 1]) : Infinity;
const only = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--limit");
/** same file naming as the Python harvesters (non-ASCII letters such as ł are dropped, not turned into dashes) */
const pySlug = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const MODEL = process.env.MATCH_MODEL ?? "claude-sonnet-5-5";

// ---------------------------------------------------------------- normalising
const strip = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
const STOP = new Set(
  "a an and the of in for to from with by on at no nos op opus major minor flat sharp violin violins piano orchestra solo and et und e di de la le der die das des du sur pour avec".split(" "),
);
const CATKEYS = "op|opus|bwv|rv|kv|k|hob|hwv|twv|woo|anh|sz|bb|h|l|b|d|s|m|p|fp|ms|jw|r|trv|wq|hess|kk|wv|ct|f|x|g|c|t|rt|mwv|ew|bg|bwv anh";
export function catNums(s: string): Set<string> {
  const out = new Set<string>();
  const t = strip(s);
  for (const m of t.matchAll(new RegExp(`\\b(${CATKEYS})\\.?\\s*(\\d+[a-z]?)(?:\\s*/\\s*(\\d+))?(?!\\d)`, "g"))) {
    const key = m[1] === "opus" ? "op" : m[1];
    out.add(`${key}${m[2]}`);
  }
  return out;
}
export function words(s: string): string[] {
  return strip(s)
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((w) => w && !STOP.has(w));
}
const jaccard = (a: string[], b: string[]) => {
  const A = new Set(a);
  const B = new Set(b);
  let i = 0;
  for (const x of A) if (B.has(x)) i++;
  return A.size + B.size - i === 0 ? 0 : i / (A.size + B.size - i);
};

const isViolinish = (p: IPage) =>
  p.cats.some((c) => /violin/i.test(c)) || /violin/i.test(p.info.Instrumentation ?? "") || /violin/i.test(p.info.InstrDetail ?? "") || p.arrs.some((a) => /violin/i.test(a.heading));

function score(piece: Piece, p: IPage): number {
  const pn = catNums(piece.title);
  const cn = new Set([...catNums(p.title), ...catNums(p.info["Opus/Catalogue Number"] ?? "")]);
  let s = 0;
  for (const n of pn) if (cn.has(n)) s += 3;
  const pw = words(piece.title);
  const tw = words(`${p.info["Work Title"] ?? ""} ${p.info["Alternative Title"] ?? ""} ${p.title}`);
  s += 2 * jaccard(pw, tw);
  // containment: every word of the catalogue title appears on the page, or the page title is inside the catalogue title
  const T = new Set(tw);
  if (pw.length && pw.every((w) => T.has(w))) s += 1;
  if (isViolinish(p)) s += 0.5;
  return s;
}

function line(i: number, p: IPage): string {
  const instr = p.info.Instrumentation ?? "";
  const arrs = p.arrs.filter((a) => /violin/i.test(a.heading)).map((a) => a.heading.replace(/^\*?\s*For\s+/i, "")).slice(0, 4).join("; ");
  const forCat = p.cats.filter((c) => /^For /.test(c)).slice(0, 2).join(",");
  return `${i}|${p.title}|${p.info["Opus/Catalogue Number"] ?? ""}|${instr || forCat}|${p.nfiles < 0 ? "scans unknown" : p.nfiles ? "scans" : "no scans"}${arrs ? `|arr: ${arrs}` : ""}`;
}

// ---------------------------------------------------------------- the model call
const SYSTEM = `You match works in a violin repertoire catalogue to pages on IMSLP (the Petrucci Music Library).

IMSLP has ONE page per composition, named "Title, Catalogue number (Composer)". A page covers every edition, part and arrangement of that composition: arrangements for other instruments are listed on the original work's page, usually not on a page of their own. Collections and sets (24 Caprices, 6 Sonatas, Humoresques Op.89) have one page for the whole set.

For each catalogue work, choose the candidate page that is the SAME composition, or answer -1. Rules:
- Same composition, not same name: Op.12 No.1 is not Op.12 No.2; "Sonata No.2" is not "Sonata No.3"; a Concerto is not the Sonata by the same composer. Different instrumentation of the same work is fine only when the catalogue work is a violin version listed on that page (see "arr:" on each candidate) or the page's own instrumentation includes violin.
- A single movement, a numbered piece from a set or a piece extracted from a larger work links to the page of the work or set it belongs to, when IMSLP has no separate page for it. Prefer a page for the piece itself when the candidates include one.
- A catalogue title with "(arr. X)" is a violin arrangement of another composer's or the same composer's work: choose the page of the ORIGINAL work (the candidate list is from the original composer's IMSLP category). Prefer a candidate whose "arr:" mentions that arranger; a page without any violin arrangement still counts when it is clearly the original work, but say so in the note and use "medium".
- A catalogue title can be a different translation or spelling of the IMSLP title (German/French/Italian titles, nicknames, "Romanze" vs "Romance"). Match on catalogue numbers and content, not just words.
- IMSLP sometimes has two pages for the same work (variant spellings of the title or of the composer's given name). Prefer the page whose title follows the standard form "Title, Catalogue number (Surname, Given)" and that has scans; "scans unknown" is neutral.
- If the right page is not among the candidates, answer -1. NEVER pick a page just because it is the closest. If you are unsure whether a page is the same work, answer -1 or use "low".
- Confidence: "high" = catalogue number or unmistakable title match; "medium" = probably the same work (sets, arrangements, translated titles); "low" = a plausible guess.
- kind: "exact" (the page is for this very work), "set" (the page is for the larger work or set it belongs to), "arrangement" (the page of the original work of a "(arr.)" entry), "other".
The candidate lines are: index|IMSLP page title|catalogue number|instrumentation|scans|arr: violin arrangements listed on the page.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["matches"],
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "candidate", "confidence", "kind", "note"],
        properties: {
          id: { type: "integer" },
          candidate: { type: "integer", description: "index of the chosen candidate line, or -1 for none" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          kind: { type: "string", enum: ["exact", "set", "arrangement", "other", "none"] },
          note: { type: "string", description: "a few words: why, or what is missing" },
        },
      },
    },
  },
};

// ---------------------------------------------------------------- main
const cat: Piece[] = read("public/data/catalogue.json").pieces;
const resolve: Record<string, { category: string | null; size: number }> = read("data/cache/imslp-all/resolve.json");
const unlinked = cat.filter((p) => !p.imslpPage);
const byComposer = new Map<string, Piece[]>();
for (const p of unlinked) byComposer.set(p.composer, [...(byComposer.get(p.composer) ?? []), p]);

const FULL_LIST_MAX = 200; // composers with at most this many pages get the whole list for every work
const PER_PIECE = 10;
const CHUNK = 25; // works per model call

async function run(composer: string, pieces: Piece[]) {
  const r = resolve[composer];
  const catFile = r?.category ? `data/cache/imslp-all/pages/${pySlug(r.category)}.json` : null;
  const searchFile = `data/cache/imslp-all/pages/search--${pySlug(composer)}.json`; // hits of imslp_search.py, for composers without a category
  const files = [catFile, searchFile].filter((f): f is string => Boolean(f) && exists(f!));
  const file = files.length ? files[0] : null;
  const out = `data/expansion/imslp/matches/${slug(composer)}.json`;
  const surnameExists = exists(`data/cache/imslp-all/surname/${pySlug(composer)}.json`);
  if (!file && !surnameExists) return { composer, status: "no-category" as const, n: pieces.length };
  if (exists(out) && !redo) return { composer, status: "skipped" as const, n: pieces.length };
  const byTitle = new Map<string, IPage>();
  for (const f of files) for (const p of read(f).rows as IPage[]) if (!byTitle.has(p.title)) byTitle.set(p.title, p);
  // every page with the composer's surname in its title (imslp_surname.py): titles only, so no instrumentation / scan info (nfiles -1 = unknown)
  const surnameFile = `data/cache/imslp-all/surname/${pySlug(composer)}.json`;
  if (exists(surnameFile))
    for (const t of read(surnameFile).titles as string[])
      if (!byTitle.has(t)) byTitle.set(t, { title: t, pageid: 0, info: {}, nfiles: -1, arrs: [], cats: [] });
  const pages = [...byTitle.values()];
  const results: any[] = [];
  for (let i = 0; i < pieces.length; i += CHUNK) {
    const chunk = pieces.slice(i, i + CHUNK);
    let cands: IPage[];
    if (pages.length <= FULL_LIST_MAX) cands = pages;
    else {
      const seen = new Map<string, IPage>();
      for (const pc of chunk) {
        // score against all pages (not only violin-relevant): the original of an arrangement may be a piano or orchestral work
        const ranked = pages.map((p) => ({ p, s: score(pc, p) })).sort((a, b) => b.s - a.s);
        for (const x of ranked.slice(0, PER_PIECE)) if (x.s > 0.4) seen.set(x.p.title, x.p);
        for (const x of ranked.filter((x) => isViolinish(x.p)).slice(0, 4)) if (x.s > 0.4) seen.set(x.p.title, x.p);
      }
      cands = [...seen.values()];
    }
    if (!cands.length) {
      for (const pc of chunk) results.push({ id: pc.id, page: null, confidence: "high", kind: "none", note: "no candidate pages" });
      continue;
    }
    cands = cands.slice().sort((a, b) => a.title.localeCompare(b.title));
    const user = `Composer: ${composer}\n\nCANDIDATE IMSLP PAGES\n${cands.map((p, i) => line(i, p)).join("\n")}\n\nCATALOGUE WORKS TO MATCH (id|title|category|accompaniment${chunk.some((c) => c.set) ? "|set" : ""})\n${chunk
      .map((c) => `${c.id}|${c.title}|${c.type}|${c.accompaniment}${c.set ? `|set: ${c.set}` : ""}`)
      .join("\n")}`;
    const res = await ask<{ matches: any[] }>({ label: `imslp-match ${composer}`, model: MODEL, system: SYSTEM, user, schema: SCHEMA, effort: "low", maxTokens: 16000 });
    const got = new Map(res.matches.map((m) => [m.id, m]));
    for (const pc of chunk) {
      const m = got.get(pc.id);
      const cand = m && m.candidate >= 0 && m.candidate < cands.length ? cands[m.candidate] : null;
      results.push({
        id: pc.id,
        page: cand ? cand.title : null,
        confidence: m?.confidence ?? "low",
        kind: cand ? m!.kind : "none",
        nfiles: cand ? cand.nfiles : undefined,
        note: m?.note ?? "no answer",
      });
    }
  }
  // keep earlier answers for works that are not being re-matched now (their pages may already be applied)
  if (exists(out)) {
    const redone = new Set(results.map((r) => r.id));
    results.push(...(read(out) as any[]).filter((r) => !redone.has(r.id)));
  }
  write(out, results);
  return { composer, status: "done" as const, n: pieces.length, linked: results.filter((x) => x.page).length };
}

(async () => {
  let todo = [...byComposer.entries()].filter(([c]) => !only.length || only.some((o) => c.toLowerCase().includes(o.toLowerCase())));
  todo = todo.slice(0, limit);
  console.log(`${todo.length} composers, ${todo.reduce((s, [, v]) => s + v.length, 0)} unlinked works; spent so far $${spentSoFar().toFixed(2)}`);
  const stats = await pool(todo, 4, async ([c, ps]) => {
    try {
      const r = await run(c, ps);
      if (r.status === "done") console.log(`${c}: ${r.linked}/${r.n}`);
      return r;
    } catch (e: any) {
      console.log(`${c}: FAILED ${e.message}`);
      return { composer: c, status: "failed" as const, n: ps.length };
    }
  });
  const by = (s: string) => stats.filter((x) => x.status === s);
  console.log(`done: ${by("done").length}, no category: ${by("no-category").length} (${by("no-category").reduce((s, x) => s + x.n, 0)} works), skipped: ${by("skipped").length}, failed: ${by("failed").length}`);
  console.log(`spent $${spentSoFar().toFixed(2)}`);
})();
