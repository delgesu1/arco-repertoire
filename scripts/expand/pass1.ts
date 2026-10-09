/**
 * Pass 1 — IMSLP pages -> catalogue decisions, per composer.
 * For every violin-relevant IMSLP page the model says: already covered (existing ids), new entries to add, or skip (with a reason).
 *
 *   npx tsx --env-file=.env.local scripts/expand/pass1.ts [composer substring …]     writes data/expansion/pass1/<slug>.json
 *
 * Resumable per composer (existing output files are skipped; delete to redo).
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ACCOMPANIMENTS, CATEGORIES, ROOT, anchorLines, ask, existingLine, loadRows, pool, read, slug, spentSoFar, write, type Row } from "./common";

const { rows } = loadRows();
const digest: Record<string, { orig: Page[]; arr: Page[]; other: Page[] }> = read("data/cache/imslp-digest.json");
const targets: string[] = read("data/expansion/target-composers-sheet-names.json");
const NOTABLE = new Set(
  readFileSync(join(ROOT, "scripts/expand/fetch_wikitext.py"), "utf8")
    .split('NOTABLE = """')[1]
    .split('""".split()')[0]
    .split(/\s+/)
    .map((s) => s.toLowerCase()),
);

interface Page {
  title: string;
  work: string;
  pageid: number;
  orig: string[];
  arr: string[];
  keys: string[];
  genre: string[];
  period: string[];
  arrangers: string[];
}
interface Wiki {
  title: string;
  info: Record<string, string>;
  arrs: { heading: string; arrangers: string[] }[];
}

const SYSTEM = `You are an expert violin teacher and music librarian completing a graded violin-repertoire database ("Arco Repertoire", ~2,250 works graded 1–10 for violin teachers and students). You will receive, for ONE composer, (a) the entries already in the database and (b) a batch of IMSLP work pages involving the violin. For each IMSLP item decide: already covered, add new catalogue entries, or skip.

## Scope — what belongs in the database
Include works in which the violin is the solo / principal instrument or one of at most three solo instruments:
- violin & orchestra (concertos, concert pieces, romances, fantasies, rondos, double/triple concertos where the violin is a principal soloist),
- violin & piano / harpsichord / organ / continuo / guitar / harp (sonatas, character pieces, showpieces, suites),
- solo violin, two or three violins (duos, trio sonatas for 2 violins + continuo), violin & viola/cello duos.
Also include doubtful-but-performed works (e.g. a work whose attribution is questioned but which is played and recorded) and reconstructed works that are performed (e.g. "BWV 1052R"). Include arrangements for violin ONLY if they are ESTABLISHED: made by a notable violinist/teacher/composer (Kreisler, Heifetz, Auer, Joachim, Elman, Zimbalist, Kochański, Szigeti, Milstein, Wilhelmj, Burmester, Hubay, Sarasate, Ysaÿe, Hartmann, Franko, Press, Achron, Dushkin, Székely, Tsyganov, the composer himself, …) AND widely published/played/recorded or on exam syllabi. Skip obscure or amateur arrangements, arrangements for unusual combinations, and multi-instrument ensemble arrangements.
Skip (give a short reason): string quartets/trios/quintets and other chamber music where the violin is one of 4+ equal parts or a piano-trio part; orchestral, vocal, choral and keyboard works without a violin soloist; fragments, sketches and lost works; clearly spurious works nobody plays; items that duplicate another item in this batch or an existing entry; arrangements that are not established.

## How to answer each item
Every item in the batch must get exactly one decision with its ref:
- covered_ids: ids of EXISTING entries that already represent this work (or part of it). Match by composer + work + catalogue number + key, allowing different spellings (Op.22 = Op. 22; "Violin Sonata in A major, K.305" = "Sonata in A major, K. 305"). A collection page can cover several existing entries.
- entries: NEW entries to add (may be several for a collection that is conventionally split — see rules). Leave empty if nothing new.
- skip: a short reason if you add nothing and nothing is covered (otherwise "").
If a page is partly covered (e.g. 12 pieces, 5 exist) list the covered ids AND add the missing pieces.
Never add an entry that duplicates an existing one or one you already added (earlier batches are listed to you).

## House style of entries
title: "<Form> [No. N] in <Key> major/minor, <catalogue>" — examples: "Concerto No. 1 in D major, Op. 6"; "Sonata in A major, K. 305"; "Concerto in A minor, BWV 1041"; "Caprice No. 1 in E major, Op. 1 No. 1"; "Légende in G minor, Op. 17"; "Zigeunerweisen in C minor, Op. 20"; "Humoresque No. 1 in D minor, Op. 87 No. 1"; "Concerto in E major, RV 271 'L'amoroso'"; "Sonata No. 9 in A major, Op. 47 ('Kreutzer')"; "Hungarian Dance No. 1 in G minor, WoO 1 No. 1 (arr. Joachim)"; "Méditation (from Thaïs)"; "Humoresque in G-flat major, Op. 101 No. 7 (arr. Kreisler)"; "Kol Nidrei in D minor, Op. 47 (orig. cello)".
- Keys are spelled "G minor", "B-flat major", "F-sharp minor". Catalogue abbreviations as scholars cite them: Op., K., BWV, RV, HWV, WoO, Sz., L., D., FWV, MS, Hob., TWV, JW, WAB, etc. Use only numbers given in the IMSLP data or that you are certain of; never invent a catalogue number.
- Use the work's usual title in the original language for character pieces (Liebesfreud, Légende, Havanaise) and English for generic forms (Concerto, Sonata, Romance).
- Nicknames go in double quotes or parentheses after the number. Arrangements end with "(arr. Surname)"; works originally for another instrument say "(orig. cello)" etc.
- category: exactly one of ${CATEGORIES.map((c) => `"${c}"`).join(", ")}.
  Concerto = multi-movement works for violin and orchestra; Concert Piece (orch.) = single-movement/lyrical works with orchestra (romances, poems, fantasies, rondos); Virtuoso Showpiece = display pieces (fantasies, variations, Spanish/gypsy showpieces, paraphrases); Sonata / Duo (vln & pno) = sonatas/sonatinas and large duos with keyboard or continuo; Suite / Set = multi-movement suites and cohesive sets; Short Piece = character pieces, encores, transcriptions (2–8 min); Solo Violin = unaccompanied; Études & Caprices = study collections and concert caprices; Duet / Double Concerto = two or more soloists, or unaccompanied duos.
- accompaniment: one of ${ACCOMPANIMENTS.map((c) => `"${c}"`).join(", ")}. Concertos: "Orchestra (piano reduction)"; concert pieces playable either way: "Piano or orchestra"; baroque sonatas: "Continuo" (or "Harpsichord or piano" for fully written keyboard parts); 2 violins alone: "2 violins".
- minutes: realistic performance length of the whole piece in whole minutes (use IMSLP's average duration when given); 0 only if truly unknown.
- set: name of the collection when the piece belongs to a published set/opus group, in the form used by the database ("Violin Sonatas, Op. 2", "Romantic Pieces, Op. 75", "24 Caprices, Op. 1"); "" for stand-alone works.
- notes: a teaching-focus phrase of at most 12 words (e.g. "Double-stopped opening theme", "Viennese waltz; style, portamento, rubato"). Give notes only when you actually know the piece; otherwise "".
- arranger: surname(s) for arrangements, "" otherwise.
- Collections: give each independently performable piece its own entry (each Hungarian Dance, each Caprice, each Humoresque). Add a separate "complete" entry (title with "(complete)" or the set title, category "Suite / Set") only for a cohesive cycle that is commonly played whole (e.g. "Four Romantic Pieces, Op. 75", "Six Sonatas for Solo Violin, Op. 27" no — sonata cycles are NOT given a complete entry). Do NOT split sonatas or concertos into movements (the one exception, already handled in the database, is Bach's solo works).
- Vivaldi/Handel/Bach-type catalogues: one entry per work, with every catalogue number you know (e.g. "Concerto in D major, Op. 3 No. 9, RV 230").

## Levels (1–10) — teaching difficulty of the WHOLE work for a student/professional learning it
${"{LEVELS}"}
Calibrate to the anchors below, which come from this database: the same piece should get the same level as comparable ones there. Use the composer's existing entries (shown in the batch) as the primary anchors. Single movements and short arrangements are usually easier than complete works. Do not cluster everything in the middle: obscure student-grade pieces exist at levels 1–3, and technical monsters at 9–10.
confidence: "high" if you know the piece well, "medium" if you infer from similar works, "low" if you are guessing (then say why in level_basis).
level_basis: ≤12 words naming the comparison/anchor you used.

## Level anchors from the database
{ANCHORS}
`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["decisions"],
  properties: {
    decisions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["ref", "covered_ids", "entries", "skip"],
        properties: {
          ref: { type: "string" },
          covered_ids: { type: "array", items: { type: "integer" } },
          skip: { type: "string" },
          entries: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["title", "level", "category", "accompaniment", "minutes", "set", "notes", "arranger", "confidence", "level_basis"],
              properties: {
                title: { type: "string" },
                level: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
                category: { type: "string", enum: [...CATEGORIES] },
                accompaniment: { type: "string", enum: [...ACCOMPANIMENTS] },
                minutes: { type: "integer" },
                set: { type: "string" },
                notes: { type: "string" },
                arranger: { type: "string" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                level_basis: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

function wikiFor(p: Page): Wiki | null {
  const f = join(ROOT, "data/cache/imslp-wiki", `${p.pageid}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}
const sur = (a: string) => a.split("|").filter(Boolean).slice(-1)[0];
function notableArrs(w: Wiki | null) {
  if (!w) return [];
  return w.arrs.filter((a) => {
    const m = a.heading.match(/\(([^()]*)\)\s*$/);
    const who = (m ? m[1] : "").toLowerCase();
    return /violin/i.test(a.heading) && !/^\*/.test(a.heading) && [...NOTABLE].some((n) => who.includes(n));
  });
}
function movements(s: string) {
  const t = [...s.matchAll(/title=(.+?)(?= level=|$)/g)].map((m) => m[1].replace(/\s*\(\d+ bars\)/, "").trim());
  return t.length ? t.slice(0, 8).join("; ") : s.slice(0, 80);
}

function lineFor(ref: string, p: Page, kind: "orig" | "arr") {
  const w = wikiFor(p);
  const i = w?.info ?? {};
  const bits = [`${ref}: ${p.title.replace(/ \([^()]*\)$/, "")}`];
  if (kind === "orig") bits.push(`scoring: ${p.orig.slice(0, 3).join(" / ")}`);
  else bits.push(`original work (not for violin); violin arrangements by notable arrangers: ${notableArrs(w).map((a) => a.heading).join("; ")}`);
  if (p.keys.length) bits.push(`key: ${p.keys.join("/")}`);
  if (p.genre.length) bits.push(`genre: ${p.genre.join(", ")}`);
  if (i["Year/Date of Composition"]) bits.push(`year: ${i["Year/Date of Composition"]}`);
  if (i["Average Duration"]) bits.push(`IMSLP duration: ${i["Average Duration"]}`);
  if (i["Number of Movements/Sections"]) bits.push(`parts: ${movements(i["Number of Movements/Sections"])}`);
  if (i["Alternative Title"]) bits.push(`alt title: ${i["Alternative Title"]}`);
  if (i["Dedication"] && kind === "orig") bits.push(`dedic.: ${i["Dedication"].slice(0, 60)}`);
  if (kind === "orig" && w) {
    const va = notableArrs(w).map((a) => a.heading);
    if (va.length) bits.push(`also arranged for violin: ${va.slice(0, 5).join("; ")}`);
  }
  return bits.join(" | ");
}

const EXTEND = process.argv.includes("--extend");
async function runComposer(composer: string) {
  const out = `data/expansion/pass1/${slug(composer)}.json`;
  const prior: { decisions: any[] } | null = existsSync(join(ROOT, out)) ? read(out) : null;
  if (prior && !EXTEND) return;
  const done = new Set((prior?.decisions ?? []).map((d) => d.pageid));
  const key = Object.keys(digest).find((k) => k === composer) ?? Object.keys(digest).find((k) => k.split(",")[0] === composer.split(",")[0]);
  const dg = key ? digest[key] : { orig: [], arr: [], other: [] };
  const mine = rows.filter((r) => r.composer === composer);
  const info = mine[0];
  const items: { ref: string; page: Page; kind: "orig" | "arr" }[] = [];
  dg.orig.forEach((p, i) => !done.has(p.pageid) && items.push({ ref: `P${i + 1}`, page: p, kind: "orig" }));
  dg.arr.forEach((p, i) => {
    if (!done.has(p.pageid) && notableArrs(wikiFor(p)).length) items.push({ ref: `A${i + 1}`, page: p, kind: "arr" });
  });
  if (!items.length) return;
  const levels = read("data/source/levels.json").levels.map((l: any) => `${l.level} = ${l.name} (about ${l.exam})`).join("\n");
  const system = SYSTEM.replace("{LEVELS}", levels).replace("{ANCHORS}", anchorLines(rows));
  const existing = mine.map(existingLine).join("\n");
  const decisions: any[] = [...(prior?.decisions ?? [])];
  const addedTitles: string[] = decisions.flatMap((d) => d.entries.map((e: any) => `${e.title} (L${e.level})`));
  const CHUNK = 40;
  for (let i = 0; i < Math.max(items.length, 1); i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    if (!chunk.length) break;
    const user = `Composer: ${composer} (${info?.dates ?? ""}, ${info?.nat ?? ""}; era: ${info?.era ?? ""})

Existing database entries for this composer (id|title|level|category|accompaniment|minutes|set):
${existing || "(none)"}

New entries already added from earlier batches (do not duplicate):
${addedTitles.length ? addedTitles.join("\n") : "(none yet)"}

IMSLP items to decide (${chunk.length}):
${chunk.map((c) => lineFor(c.ref, c.page, c.kind)).join("\n")}`;
    let res: { decisions: any[] };
    for (let attempt = 0; ; attempt++) {
      res = await ask({ label: `pass1 ${composer} ${i}`, system, user, schema: SCHEMA, effort: "medium", maxTokens: 40000 });
      const got = new Set(res.decisions.map((d) => d.ref));
      const missing = chunk.filter((c) => !got.has(c.ref));
      if (!missing.length || attempt >= 2) {
        if (missing.length) console.warn(`${composer}: ${missing.length} refs got no decision: ${missing.map((m) => m.ref).join(",")}`);
        break;
      }
      console.warn(`${composer}: retrying, ${missing.length} refs missing`);
    }
    for (const d of res.decisions) {
      const c = chunk.find((x) => x.ref === d.ref);
      if (!c) continue;
      decisions.push({ ...d, page: c.page.title, pageid: c.page.pageid, kind: c.kind });
      for (const e of d.entries) addedTitles.push(`${e.title} (L${e.level})`);
    }
  }
  write(out, { composer, items: items.length, decisions });
  const added = decisions.reduce((n, d) => n + d.entries.length, 0);
  console.log(`${composer}: ${items.length} items -> ${added} new entries, ${decisions.filter((d) => d.covered_ids.length).length} covered pages; spent $${spentSoFar().toFixed(2)}`);
}

async function main() {
  const only = process.argv.slice(2).filter((s) => !s.startsWith("--")).map((s) => s.toLowerCase());
  const todo = targets.filter((t) => !only.length || only.some((o) => !o.startsWith("--") && t.toLowerCase().includes(o)));
  // big composers first so the long jobs overlap with the short ones
  const size = (c: string) => {
    const k = Object.keys(digest).find((x) => x === c || x.split(",")[0] === c.split(",")[0]);
    return k ? digest[k].orig.length + digest[k].arr.length : 0;
  };
  todo.sort((a, b) => size(b) - size(a));
  await pool(todo, 4, async (c) => {
    try {
      await runComposer(c);
    } catch (e) {
      console.error(`FAILED ${c}: ${e instanceof Error ? e.message : e}`);
    }
  });
  console.log(`done; total spent $${spentSoFar().toFixed(2)}`);
}
main();
