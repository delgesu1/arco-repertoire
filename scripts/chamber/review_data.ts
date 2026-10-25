/**
 * The data behind the owner's review page for the fact-check doubts, the open rulings and the parked works
 * (phase 5). Writes one JSON file that the page embeds; the owner's answers are kept in the page's own store
 * and read back from there.
 *
 *   npx tsx scripts/chamber/review_data.ts <out.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ChamberWork } from "../../lib/chamber/types";
import { FORMATIONS, instrumentList } from "../../lib/chamber/vocab";

const ROOT = join(__dirname, "..", "..");
const read = <T>(p: string): T => JSON.parse(readFileSync(join(ROOT, p), "utf8"));
const works = read<ChamberWork[]>("data/chamber/works.json");
const byId = new Map(works.map((w) => [w.id, w]));
const judged = read<Record<string, { confidence: string; video: { id: string; title: string } | null }>>("data/chamber/recordings-judged.json");
const doubts = read<{ id: number; title: string; composer: string; note: string; sources: string[]; chunk: string }[]>("data/chamber/verify/doubts.json");
type ParkedWork = Pick<ChamberWork, "composer" | "title" | "formation" | "instruments" | "alternatives" | "optional" | "year"> & { floor?: Record<string, string>; sources?: string[] };
const parked = read<{ slice: string; work: ParkedWork }[]>("data/chamber/curation/parked-low-confidence.json");
const label = (k: string) => FORMATIONS.find((f) => f.key === k)?.singular ?? k;
const firstLast = (n: string) => (n.includes(", ") ? `${n.split(", ").slice(1).join(", ")} ${n.split(", ")[0]}` : n);

// which open ruling settles a doubt, chosen by reading each doubt (keyword matching picked up too many)
const RULED: Record<string, number[]> = {
  bass: [102528, 104604, 100927, 100873, 100875, 100876, 100879, 100880, 101147],
  keyboard: [101937, 105702, 105703, 105704, 105705, 105706, 105707],
  band: [100867, 100868, 100869, 100870, 100871, 100872, 101041, 101042, 104830, 101180, 105491, 105492, 105493, 105494, 105495, 105496],
  paisiello: [],
  selfpub: [106604, 106619, 106620, 106621, 106622, 106671, 106672, 106673, 106674, 106675, 106676],
};
const rulingOf = (d: (typeof doubts)[number]) =>
  d.composer.startsWith("Paisiello") ? "paisiello" : (Object.entries(RULED).find(([, ids]) => ids.includes(d.id))?.[0] ?? null);
// the main concern of a doubt; most notes cite a recording as evidence, so the floor is tested on stronger phrases
const topic = (n: string) =>
  /attribut|spurious|misattrib|is by |arrangement|arranged|transcription|duplicate|identity|same work|different (work|sonata|composer)/i.test(n) ? "identity"
  : /only recording|no recording|not recorded|no .{0,20}recording (was )?found|one[- ]to[- ]a[- ]part|track record|self-published|own[- ]label|only one movement|only selections|excerpts?|directed band|orchestra|one concert|only a .{0,30}concert|floor/i.test(n) ? "floor"
  : /scor|player|instrument|bass|continuo|violone|flute|oboe|viol\b|harpsichord|optional|ad lib|alternative/i.test(n) ? "scoring"
  : "facts";

const out = {
  built: new Date().toISOString().slice(0, 10),
  doubts: doubts.map((d) => {
    const w = byId.get(d.id)!;
    const j = judged[String(d.id)];
    return {
      id: d.id,
      composer: firstLast(w.composer),
      sort: w.composer,
      title: w.title,
      formation: label(w.formation),
      scoring: instrumentList(w.instruments, { alternatives: w.alternatives, optional: w.optional }),
      year: w.year || null,
      minutes: w.minutes,
      level: w.level,
      notes: w.notes || null,
      imslp: w.imslpPage || null,
      video: j?.video && (j.confidence === "high" || j.confidence === "medium") ? { id: j.video.id, title: j.video.title } : null,
      doubt: d.note,
      sources: d.sources,
      chunk: d.chunk,
      topic: topic(d.note),
      ruling: rulingOf(d),
    };
  }),
  parked: parked
    .filter((p) => !works.some((w) => w.composer === p.work.composer && w.title === p.work.title))
    .map((p) => ({
      key: `${p.slice}:${p.work.composer}:${p.work.title}`,
      composer: firstLast(p.work.composer),
      title: p.work.title,
      formation: label(p.work.formation),
      scoring: instrumentList(p.work.instruments, { alternatives: p.work.alternatives, optional: p.work.optional }),
      year: p.work.year || null,
      floor: [p.work.floor?.recorded, p.work.floor?.published, p.work.floor?.performed].filter(Boolean).join(" · ") || null,
      sources: p.work.sources ?? [],
    })),
};
writeFileSync(process.argv[2], JSON.stringify(out));
const c = (k: string) => out.doubts.filter((d) => d.ruling === k).length;
console.log(`${out.doubts.length} doubts (bass ${c("bass")}, band ${c("band")}, keyboard ${c("keyboard")}, paisiello ${c("paisiello")}, selfpub ${c("selfpub")}); topics ${JSON.stringify(out.doubts.reduce<Record<string, number>>((m, d) => ((m[d.topic] = (m[d.topic] ?? 0) + 1), m), {}))}; ${out.parked.length} parked works not in the catalogue`);
