/**
 * Phase 5, tier 1: compares every work that names its IMSLP page with what the census harvested from that page
 * (data/chamber/census/candidates.jsonl): catalogue numbers, key, year, duration and scoring. No network, no agents.
 * Mismatches are not errors: they are where a fact-check agent should look first.
 *
 *   npx tsx scripts/chamber/imslp_crosscheck.ts      # writes data/chamber/verify/imslp-crosscheck.json and prints counts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberWork, InstrumentKey } from "../../lib/chamber/types";

const ROOT = join(__dirname, "..", "..");
const works: ChamberWork[] = JSON.parse(readFileSync(join(ROOT, "data/chamber/works.json"), "utf8"));
interface Page {
  title: string;
  opus: string;
  key: string;
  year: number | null;
  minutes: number | null;
  instruments: Partial<Record<InstrumentKey, number>>;
  alsoScored?: string[];
  scoring: string;
  works: number;
  flags: string[];
}
const pages = new Map<string, Page>();
for (const line of readFileSync(join(ROOT, "data/chamber/census/candidates.jsonl"), "utf8").split("\n"))
  if (line.trim()) {
    const p = JSON.parse(line) as Page;
    pages.set(p.title, p);
  }

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase();
// catalogue numbers as "prefix:number" (op:33, k:465, hob:iii:38, d:810, rv:63, twv:43:e4 …), sub-numbers dropped
const CAT = /\b(op|opus|k|kv|d|hob|rv|twv|hwv|bwv|g|b|wq|h|z|p|fwv|sz|m|l|jw|woo|ms|wk|t|bv|c|s|bb|cs|trv|mwv)\.?\s*((?:[ivxlc]+[:.]\s*)?[a-z]?\d+[a-z]?)/gi;
const cats = (s: string) => {
  const out = new Map<string, Set<string>>();
  for (const m of fold(s).matchAll(CAT)) {
    const pre = m[1].replace(/^opus$/, "op").replace(/^kv$/, "k");
    const num = m[2].replace(/\s/g, "").replace(/\./g, ":");
    if (!out.has(pre)) out.set(pre, new Set());
    out.get(pre)!.add(num);
  }
  return out;
};
const KEY = /\bin ([a-g](?:-flat|-sharp)?) (major|minor)\b/;
const keyOf = (title: string) => {
  const m = fold(title).match(KEY);
  return m ? `${m[1]} ${m[2]}` : null;
};
const imslpKey = (k: string) => {
  const m = fold(k).match(/^([a-g])(?:[- ]?(flat|sharp))? (major|minor)/);
  return m ? `${m[1]}${m[2] ? `-${m[2]}` : ""} ${m[3]}` : null;
};
const yearOf = (y: string) => Number(y.match(/\d{4}/)?.[0] ?? NaN);
// the census joined duration ranges into one number ("3035" for 30–35 minutes)
const minutesRange = (m: number | null): [number, number] => {
  if (!m) return [0, 0];
  const s = String(m);
  if (m > 240 && s.length === 4) return [Number(s.slice(0, 2)), Number(s.slice(2))];
  if (m > 240 && s.length === 3) return [Number(s.slice(0, 1)), Number(s.slice(1))];
  return [m, m];
};
// a continuo bass may be realised by any of these, so they are left out of the comparison whenever either side has a continuo
const CONTINUO_FAMILY = ["continuo", "harpsichord", "organ", "cello", "double-bass", "viola-da-gamba", "violone", "bassoon", "lute", "theorbo", "viol", "bass-viol"];
const scoringKey = (ins: Partial<Record<InstrumentKey, number>>, continuo: boolean) => {
  const s = { ...ins } as Record<string, number>;
  if (continuo) for (const k of CONTINUO_FAMILY) delete s[k];
  delete s.electronics;
  return Object.entries(s).sort(([a], [b]) => a.localeCompare(b)).map(([k, n]) => `${n} ${k}`).join(", ");
};
const LABEL: Record<string, string> = { violins: "violin", violas: "viola", cellos: "cello", "double basses": "double-bass", flutes: "flute", oboes: "oboe", clarinets: "clarinet", bassoons: "bassoon", horns: "horn", trumpets: "trumpet", pianos: "piano", harpsichords: "harpsichord", "viols": "viola-da-gamba" };
const parseScoring = (s: string) => {
  const out: Record<string, number> = {};
  for (const part of s.split(/,\s*/)) {
    const m = part.trim().match(/^(\d+)\s+(.+)$/);
    const [n, name] = m ? [Number(m[1]), m[2]] : [1, part.trim()];
    const key = LABEL[name] ?? name.replace(/ /g, "-");
    out[key] = (out[key] ?? 0) + n;
  }
  return out as Partial<Record<InstrumentKey, number>>;
};

type Flag = { field: string; ours: unknown; imslp: unknown };
const flagged: Record<number, { title: string; imslpPage: string; flags: Flag[] }> = {};
const counts: Record<string, number> = {};
let compared = 0;
let noPage = 0;
for (const w of works) {
  if (!w.imslpPage) continue;
  const p = pages.get(w.imslpPage);
  if (!p) {
    noPage++;
    continue;
  }
  compared++;
  const collection = p.flags.includes("collection") || p.works > 1;
  const flags: Flag[] = [];
  // catalogue numbers: a prefix both name must share a number
  const ours = cats(w.title);
  const theirs = cats(p.opus);
  for (const [pre, nums] of ours) {
    const t = theirs.get(pre);
    if (!t || !t.size) continue;
    const ok = [...nums].some((n) => [...t].some((x) => x === n || x.startsWith(`${n}:`) || n.startsWith(`${x}:`) || (collection && x.includes("-"))));
    if (!ok && !/[-–]/.test(p.opus)) flags.push({ field: `catalogue ${pre}`, ours: [...nums].join(", "), imslp: p.opus });
  }
  if (!collection) {
    const k1 = keyOf(w.title);
    const k2 = imslpKey(p.key);
    if (k1 && k2 && k1 !== k2) flags.push({ field: "key", ours: k1, imslp: p.key });
    const [lo, hi] = minutesRange(p.minutes);
    if (w.minutes && lo && (w.minutes < lo - Math.max(3, 0.25 * lo) || w.minutes > hi + Math.max(3, 0.25 * hi))) flags.push({ field: "minutes", ours: w.minutes, imslp: lo === hi ? lo : `${lo}–${hi}` });
  }
  const y = yearOf(w.year);
  if (p.year && y && Math.abs(y - p.year) > 3 && !w.year.includes(String(p.year))) flags.push({ field: "year", ours: w.year, imslp: p.year });
  const theirs2 = [p.instruments, ...(p.alsoScored ?? []).map(parseScoring)];
  const continuo = "continuo" in w.instruments || theirs2.some((t) => "continuo" in t);
  const mine = scoringKey(w.instruments, continuo);
  if (!theirs2.map((t) => scoringKey(t, continuo)).includes(mine))
    flags.push({ field: "scoring", ours: scoringKey(w.instruments, false), imslp: [p.scoring, ...(p.alsoScored ?? [])].join(" | ") });
  if (flags.length) {
    flagged[w.id] = { title: w.title, imslpPage: w.imslpPage, flags };
    for (const f of flags) counts[f.field.split(" ")[0]] = (counts[f.field.split(" ")[0]] ?? 0) + 1;
  }
}
mkdirSync(join(ROOT, "data/chamber/verify"), { recursive: true });
writeFileSync(join(ROOT, "data/chamber/verify/imslp-crosscheck.json"), JSON.stringify(flagged, null, 1) + "\n");
console.log(
  `${compared} works compared with their IMSLP page (${noPage} name a page the census did not harvest); ` +
    `${Object.keys(flagged).length} have at least one mismatch: ${Object.entries(counts).map(([k, n]) => `${k} ${n}`).join(", ")}`,
);
