/**
 * Step 6 of the IMSLP link pass: an independent second opinion on the new matches.
 *
 *   npx tsx --env-file=.env.local scripts/expand/imslp_verify.ts [--sample N]
 *
 * Reads   data/expansion/imslp/matches/*.json  (accepted ones that are not yet in data/imslp-pages.json, plus any already applied
 *         from these files), and the harvested page records for the chosen pages' metadata
 * Writes  data/expansion/imslp/verify.json     [{id, verdict, note}]   verdict: same | set | original | different
 *         data/expansion/imslp/rejected.json   ids whose link must not be applied (verdict "different"), read by imslp_apply.ts
 *
 * The verifier sees ONLY the catalogue entry and the chosen page's metadata (no candidate list, no first-pass reasoning).
 * Every medium-confidence match is checked, plus a random sample of the high-confidence ones.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { ROOT, ask, exists, pool, read, write } from "./common";

const args = process.argv.slice(2);
const sampleIx = args.indexOf("--sample");
const SAMPLE = sampleIx >= 0 ? Number(args[sampleIx + 1]) : 120;
const MODEL = process.env.VERIFY_MODEL ?? "claude-opus-5-5";

const cat: Record<number, { id: number; composer: string; title: string; accompaniment: string; type: string }> = Object.fromEntries(
  (read("public/data/catalogue.json").pieces as any[]).map((p) => [p.id, p]),
);

// title -> harvested record
const recs = new Map<string, any>();
const pagesDir = "data/cache/imslp-all/pages";
for (const f of readdirSync(join(ROOT, pagesDir))) for (const r of read(`${pagesDir}/${f}`).rows) if (!recs.has(r.title)) recs.set(r.title, r);

const mdir = "data/expansion/imslp/matches";
const matches: any[] = readdirSync(join(ROOT, mdir))
  .filter((f) => f.endsWith(".json"))
  .flatMap((f) => read(`${mdir}/${f}`))
  .filter((m) => m.page && m.confidence !== "low" && cat[m.id]);

// deterministic sample of the high-confidence matches
let h = 7;
const rnd = () => ((h = (h * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const high = matches.filter((m) => m.confidence === "high").sort(() => rnd() - 0.5).slice(0, SAMPLE);
const todo = [...matches.filter((m) => m.confidence === "medium"), ...high];

const prev: any[] = exists("data/expansion/imslp/verify.json") ? read("data/expansion/imslp/verify.json") : [];
const done = new Set(prev.map((v) => v.id));
const pending = todo.filter((m) => !done.has(m.id));

const SYSTEM = `You check links from a violin repertoire catalogue to IMSLP (Petrucci Music Library) work pages.

IMSLP has one page per composition (or per published set/collection). Arrangements for other instruments are listed on the original work's page. For each item you get the catalogue entry and the metadata of the IMSLP page it was linked to. Judge only whether the page is the right page for the catalogue entry:
- "same": the page is for this very composition.
- "set": the catalogue entry is one piece/movement/numbered item of the larger work or set that the page covers, and IMSLP has no better page for it.
- "original": the catalogue entry is an arrangement ("arr.") and the page is the page of the original work it was arranged from.
- "different": the page is for another composition (different opus number or number within a set, different work, different instrument-family such as a cello sonata for a violin sonata, a piano piece that is not the source of the arrangement). Use this whenever you have a concrete reason to think the link would send a violinist to the wrong score.
Catalogue titles may be in another language or spelling than the IMSLP title, and a catalogue number may be given in another cataloguing system; that is fine. Be strict about numbers within a set: Op.12 No.1 is not Op.12 No.2 (unless the page covers the whole set). If unsure but nothing contradicts the link, answer "same" or "set".
Items are: id | catalogue entry | IMSLP page title | catalogue number | instrumentation | violin arrangements listed on the page.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["verdicts"],
  properties: {
    verdicts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "verdict", "note"],
        properties: {
          id: { type: "integer" },
          verdict: { type: "string", enum: ["same", "set", "original", "different"] },
          note: { type: "string", description: "a few words; for 'different' say what the page really is" },
        },
      },
    },
  },
};

const line = (m: any) => {
  const p = cat[m.id];
  const r = recs.get(m.page);
  const arrs = (r?.arrs ?? []).filter((a: any) => /violin/i.test(a.heading)).map((a: any) => a.heading.replace(/^\*?\s*For\s+/i, "")).slice(0, 4).join("; ");
  return `${m.id} | ${p.composer.split(",")[0]}: ${p.title} (${p.accompaniment}) | ${m.page} | ${r?.info?.["Opus/Catalogue Number"] ?? ""} | ${r?.info?.Instrumentation ?? ""} | ${arrs}`;
};

(async () => {
  console.log(`${matches.length} accepted matches; verifying ${pending.length} (${todo.length - pending.length} already done)`);
  const chunks: any[][] = [];
  for (let i = 0; i < pending.length; i += 40) chunks.push(pending.slice(i, i + 40));
  const out = [...prev];
  await pool(chunks, 3, async (chunk) => {
    const res = await ask<{ verdicts: any[] }>({ label: "imslp-verify", model: MODEL, system: SYSTEM, user: chunk.map(line).join("\n"), schema: SCHEMA, effort: "low", maxTokens: 12000 });
    out.push(...res.verdicts.filter((v) => chunk.some((m) => m.id === v.id)));
    write("data/expansion/imslp/verify.json", out);
  });
  const bad = out.filter((v) => v.verdict === "different");
  write("data/expansion/imslp/rejected.json", bad.map((v) => v.id));
  console.log(`verdicts: ${out.length}; different: ${bad.length}`);
  for (const v of bad) {
    const m = matches.find((x) => x.id === v.id);
    console.log(`${v.id} | ${cat[v.id]?.composer.split(",")[0]}: ${cat[v.id]?.title} => ${m?.page}\n      ${v.note}`);
  }
})();
