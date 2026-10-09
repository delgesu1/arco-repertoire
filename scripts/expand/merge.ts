/**
 * Merge everything into the Sheet snapshot.
 *
 *   npx tsx scripts/expand/merge.ts                 dry run: summary + data/expansion/final/*.json, snapshot untouched
 *   npx tsx scripts/expand/merge.ts --write         also writes data/expansion/final/all-repertoire.next.json, data/imslp-pages.json, data/id-merges.json
 *   add --keep-unverified to keep entries that still lack a web verdict (previews only)
 *
 * Per composer: review/<slug>.json (existing + queued N-uids) + web/<slug>.json (verdicts, gaps) + pass3 (fixes, levels, dups)
 * + pass4 (graded web gaps). The policies below are deliberate; see the comments.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { HEADER, ROOT, loadRows, read, slug, write, type Row } from "./common";

const WRITE = process.argv.includes("--write");
const KEEP_UNVERIFIED = process.argv.includes("--keep-unverified");
const { values, rows } = loadRows();
const levels = read("data/source/levels.json").levels as { level: number; name: string; exam: string }[];
const accMap: Record<string, string[]> = read("data/accompaniment-map.json");
const targets: string[] = read("data/expansion/target-composers-sheet-names.json");

const maybe = <T>(p: string, d: T): T => (existsSync(join(ROOT, p)) ? read(p) : d);
const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/ł/g, "l").toLowerCase();
const STOP = new Set("no nr op in the a an major minor for violin and et de la le les du des from after arr complete".split(" "));
export const normTitle = (t: string) =>
  fold(t).replace(/\([^)]*\)/g, " ").replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w && !STOP.has(w)).join(" ");
/** like normTitle but keeps the parenthetical text ("Menuet (from Sonatine)" vs "Menuet (from Le Tombeau)") */
const normFull = (t: string) => fold(t).replace(/[^a-z0-9]+/g, " ").split(" ").filter((w) => w && !STOP.has(w)).join(" ");
const words = (t: string) => new Set(normTitle(t).split(" ").filter(Boolean));
const jaccard = (a: Set<string>, b: Set<string>) => {
  let i = 0;
  for (const x of a) if (b.has(x)) i++;
  return i / (a.size + b.size - i || 1);
};
/** catalogue tokens such as "op12n1", "k305", "bwv1041", "rv356", "woo1n17" */
const CAT_RX = /\b(op|k|bwv|rv|hwv|woo|sz|l|d|fwv|ms|hob|twv|jw|wq|cd|mwv|m|b|wab|kk)\.? ?(\d+[a-z]?)(?:[, ]+(?:no|nr)\.? ?(\d+))?/gi;
const catKeys = (t: string) => new Set([...fold(t).matchAll(CAT_RX)].map((m) => `${m[1]}${m[2]}${m[3] ? `n${m[3]}` : ""}`));
const isArr = (t: string, arranger = "") => /\(arr\./i.test(t) || !!arranger;

// ------------------------------------------------------------------ policy: what to do with audit suggestions on EXISTING rows
// Level changes I reviewed by hand (pass 3 proposed 27, all "medium"): accepted ones, keyed by composer surname + title start.
const LEVEL_ACCEPT: [string, string, number][] = [
  ["Bach", "Sonata for Violin and Continuo in E minor, BWV 1023", 5],
  ["Bartók", "Hungarian Folk Songs", 5],
  ["Beethoven", '12 Variations on "Se vuol ballare"', 3],
  ["Brahms", "Hungarian Dance No. 7 in A major", 4],
  ["Chaminade", "Capriccio, Op. 18", 5],
  ["Cui", "Orientale, Op. 50 No. 9", 3],
  ["Falla", "Danse espagnole", 7],
  ["Fauré", "Sonata No. 2 in E minor", 8],
  ["Glazunov", "Méditation in D major", 4],
  ["Kreisler", "Aucassin and Nicolette", 3],
  ["Kreisler", "Chanson Louis XIII and Pavane", 3],
  ["Kreisler", "Toy Soldiers' March", 3],
  ["Kreisler", "Syncopation", 4],
  ["Moszkowski", "Guitarre", 6],
  ["Ravel", "Sonata No. 1 in A minor", 7],
  ["Ravel", "Pièce en forme de habanera", 6],
  ["Schubert", "Sonata in A major, D. 574", 7],
  ["Stravinsky", "Russian Maiden's Song", 6],
  ["Tchaikovsky", "Valse-Scherzo", 7],
  ["Wieniawski", "Obertass", 5],
];
// Title fixes: accepted only where the new catalogue data comes from IMSLP or is a plain correction I checked.
const TITLE_FIX_ACCEPT = new Set(
  [719, 240, 937, 1083, 349, 1521, 1150, 2186, 1167, 1169, 1170, 2215, 1904, 548, 549, 378, 383, 390, 1973, 1352, 2230, 1260],
);
const SKIP_FIX = new Set(["717:category", "664:accompaniment"]);

interface Change {
  id: number | string;
  composer: string;
  title: string;
  field: string;
  before: string | number;
  after: string | number;
  reason: string;
  confidence: string;
  applied: boolean;
  why?: string;
}
const changes: Change[] = [];
const merges: { remove: number; keep: number; reason: string }[] = [];
const added: any[] = [];
const dropped: { composer: string; uid: string; title: string; why: string }[] = [];

const byId = new Map(rows.map((r) => [r.id, r]));
const edits = new Map<number, Record<string, string | number>>();
const setEdit = (id: number, k: string, v: string | number) => edits.set(id, { ...(edits.get(id) ?? {}), [k]: v });

// the existing catalogue as the reference for duplicate checks across all composers
const allExisting = rows.map((r) => ({ id: r.id, composer: r.composer, title: r.title, norm: normFull(r.title), cat: catKeys(r.title), words: words(r.title), arr: isArr(r.title) }));

for (const composer of targets) {
  const s = slug(composer);
  const rev = maybe<any>(`data/expansion/review/${s}.json`, null);
  if (!rev) continue;
  const web = maybe<any>(`data/expansion/web/${s}.json`, { verdicts: [], gaps: [], existing_issues: [] });
  const p3 = maybe<any>(`data/expansion/pass3/${s}.json`, { fixes: [], levels: [], duplicates: [] });
  const graded = maybe<any>(`data/expansion/pass4/${s}.json`, { entries: [] }).entries as any[];
  const verdict = new Map<string, any>(web.verdicts.map((v: any) => [v.uid, v]));
  const surname = composer.split(",")[0];

  // 1. queued entries -> kept / fixed / collapsed / dropped
  const kept: any[] = [];
  const collapsed = new Set<string>();
  for (const q of rev.queued as any[]) {
    const v = verdict.get(q.uid);
    let e = { ...q };
    if (/suzuki/i.test(q.title) || /suzuki/i.test(q.arranger ?? "")) {
      dropped.push({ composer, uid: q.uid, title: q.title, why: "method-book arrangement" });
      continue;
    }
    if (v) {
      if (v.verdict === "reject") {
        dropped.push({ composer, uid: q.uid, title: q.title, why: `web: ${v.note}` });
        continue;
      }
      if (v.verdict === "collapse") {
        const key = v.title || q.set;
        if (collapsed.has(key)) {
          dropped.push({ composer, uid: q.uid, title: q.title, why: `collapsed into "${key}"` });
          continue;
        }
        collapsed.add(key);
        e = { ...e, title: v.title || q.set, category: v.category || "Suite / Set", set: v.set ?? "" };
      }
      if (v.verdict === "fix") {
        for (const f of ["title", "accompaniment", "category", "set"] as const) if (v[f]) e[f] = v[f];
        if (v.minutes) e.minutes = v.minutes;
      }
      e.web_source = v.source;
    } else if (q.verify && !KEEP_UNVERIFIED) {
      dropped.push({ composer, uid: q.uid, title: q.title, why: "needs verification, no verdict" });
      continue;
    }
    kept.push(e);
  }
  for (const [i, g] of graded.entries()) kept.push({ ...g, uid: `G${i + 1}`, source: "web", web_source: g.source_ref });

  // 2. pass-3 results (existing ids are numeric strings, queued entries are N-uids)
  const keptByUid = new Map(kept.map((e) => [e.uid, e]));
  const nameOf = (id: string) => byId.get(Number(id))?.title ?? keptByUid.get(id)?.title ?? id;
  for (const f of p3.fixes as any[]) {
    const id = Number(f.id);
    if (byId.has(id)) {
      const r = byId.get(id)!;
      const field = f.field === "accompaniment" ? "acc" : f.field === "minutes" ? "min" : f.field;
      const before = (r as any)[field];
      let apply = false;
      let why = "";
      if (SKIP_FIX.has(`${id}:${f.field}`)) why = "skipped after review";
      else if (f.field === "minutes") {
        // filling gaps is safe; replacing a value only when sure or when it is off by a factor of ~1.6 or more
        const b = Number(before), v = Number(f.value);
        apply = !before || f.confidence === "high" || (b > 0 && Math.max(b / v, v / b) >= 1.6);
      }
      else if (f.field === "set" || f.field === "notes") apply = true;
      else if (f.field === "accompaniment") apply = !!accMap[f.value];
      else if (f.field === "category") apply = f.confidence === "high" || /^Suite \/ Set$/.test(f.value);
      else if (f.field === "title") {
        apply = TITLE_FIX_ACCEPT.has(id);
        if (!apply) why = "title fix not verified";
      }
      changes.push({ id, composer, title: r.title, field: f.field, before, after: f.value, reason: f.reason, confidence: f.confidence, applied: apply, why });
      if (apply) setEdit(id, field, f.field === "minutes" ? Number(f.value) : f.value);
    } else if (keptByUid.has(f.id)) {
      const e = keptByUid.get(f.id);
      e[f.field] = f.field === "minutes" ? Number(f.value) : f.value;
    }
  }
  for (const l of p3.levels as any[]) {
    const id = Number(l.id);
    if (byId.has(id)) {
      const r = byId.get(id)!;
      const ok = LEVEL_ACCEPT.find(([sn, tp]) => sn === surname && r.title.startsWith(tp));
      const apply = !!ok && ok[2] === l.level;
      changes.push({ id, composer, title: r.title, field: "level", before: r.level, after: l.level, reason: l.reason, confidence: l.confidence, applied: apply, why: apply ? "reviewed: evidence in the exam listing" : "not applied (review)" });
      if (apply) setEdit(id, "level", l.level);
    } else if (keptByUid.has(l.id)) keptByUid.get(l.id).level = l.level;
  }
  for (const d of p3.duplicates as any[]) {
    for (const rm of d.remove) {
      const id = Number(rm);
      if (byId.has(id) && byId.has(Number(d.keep))) {
        merges.push({ remove: id, keep: Number(d.keep), reason: d.reason });
        if (composer.startsWith("Hubay")) setEdit(Number(d.keep), "level", 3); // 1000 listed at 5, 1001 at 2 (ASTA CAP 5): the middle
      } else if (keptByUid.has(rm)) {
        keptByUid.delete(rm);
        dropped.push({ composer, uid: rm, title: nameOf(rm), why: `duplicate of ${d.keep}: ${d.reason}` });
      }
    }
  }

  // 3. drop queued entries that repeat an existing title anywhere in the catalogue, or another arrangement of the same piece
  const seen = new Map<string, string>();
  for (const e of [...keptByUid.values()]) {
    const nt = normFull(e.title);
    const ck = catKeys(e.title);
    const ws = words(e.title);
    const distinctive = nt.length >= 25 && nt.split(" ").length >= 4; // generic titles ("Sonata No. 2 in C major") must match within the composer
    const dupExisting = allExisting.find((x) => x.norm === nt && (x.composer === composer || distinctive));
    const dupCat = allExisting.find(
      (x) => x.composer === composer && ck.size > 0 && [...ck].some((k) => x.cat.has(k)) && jaccard(ws, x.words) >= 0.8,
    );
    const altArr =
      isArr(e.title, e.arranger) &&
      !/Indian Lament/i.test(e.title) && // Kreisler's paraphrase of the Larghetto is its own piece

      allExisting.find((x) => x.composer === composer && ck.size > 0 && [...ck].some((k) => x.cat.has(k)) && jaccard(ws, x.words) >= 0.5);
    const why = dupExisting
      ? `same title as existing id ${dupExisting.id}`
      : dupCat
        ? `same work as existing id ${dupCat.id} (${dupCat.title})`
        : altArr
          ? `another arrangement of existing id ${altArr.id} (${altArr.title})`
          : seen.has(nt)
            ? `same title as ${seen.get(nt)}`
            : "";
    if (why) {
      keptByUid.delete(e.uid);
      dropped.push({ composer, uid: e.uid, title: e.title, why });
    } else seen.set(nt, e.uid);
  }
  for (const e of keptByUid.values()) added.push({ composer, ...e });
}

// ------------------------------------------------------------------ corrections reported by the web researchers and accepted after review
{
  const dec = maybe<Record<string, { title?: string; acc?: string; min?: number; level?: number; category?: string; set?: string }>>("data/expansion/final/issue-decisions.json", {});
  for (const [sid, d] of Object.entries(dec)) {
    const id = Number(sid);
    const r = byId.get(id);
    if (!r) continue;
    for (const [k, v] of Object.entries(d)) {
      const cur = (r as any)[k];
      if (String(cur) === String(v)) continue;
      setEdit(id, k, v as string | number);
      const fieldName = k === "acc" ? "accompaniment" : k === "min" ? "minutes" : k;
      for (const c of changes) if (c.id === id && c.field === fieldName && c.applied) { c.applied = false; c.why = "superseded by a checked correction"; }
      changes.push({ id, composer: r.composer, title: r.title, field: k === "acc" ? "accompaniment" : k === "min" ? "minutes" : k, before: cur ?? "", after: v as string | number, reason: "checked against IMSLP / publisher / library sources by the web researcher", confidence: "web", applied: true });
    }
  }
}

// ------------------------------------------------------------------ estimated durations for existing rows that have none (pass 6)
{
  const est = maybe<Record<string, number>>("data/expansion/pass6/minutes.json", {});
  let n = 0;
  for (const [sid, m] of Object.entries(est)) {
    const id = Number(sid);
    const r = byId.get(id);
    if (!r || r.min || edits.get(id)?.min !== undefined || merges.some((x) => x.remove === id)) continue;
    setEdit(id, "min", m);
    changes.push({ id, composer: r.composer, title: r.title, field: "minutes", before: "", after: m, reason: "estimated duration (the Sheet had none)", confidence: "estimate", applied: true });
    n++;
  }
  if (n) console.log(`filled ${n} missing durations with estimates`);
}

// ------------------------------------------------------------------ cross-composer duplicates (an arrangement listed under both composers)
{
  const pool = [
    ...allExisting.map((x) => ({ key: String(x.id), composer: x.composer, title: x.title, words: x.words })),
    ...added.map((e) => ({ key: `${slug(e.composer)}:${e.uid}`, composer: e.composer, title: e.title, words: words(e.title) })),
  ];
  const pairs: string[] = [];
  for (let i = 0; i < pool.length; i++)
    for (let j = i + 1; j < pool.length; j++) {
      const a = pool[i], b = pool[j];
      if (a.composer === b.composer || a.words.size < 4 || b.words.size < 4) continue;
      if (jaccard(a.words, b.words) >= 0.75) pairs.push(`${a.key} ${a.composer.split(",")[0]}: ${a.title}  <->  ${b.key} ${b.composer.split(",")[0]}: ${b.title}`);
    }
  write("data/expansion/final/cross-composer-pairs.txt", pairs.join("\n"));
  if (pairs.length) console.log(`${pairs.length} cross-composer lookalikes in data/expansion/final/cross-composer-pairs.txt`);
}
// gap entries (from the web researchers) left out after review: [composer surname, title regex, reason]
const GAP_DROP: [string, RegExp, string][] = [
  ["Kreisler", /^Habanera \(from Rapsodie espagnole/i, "listed under Ravel"],
  ["Kreisler", /^Impromptu in G-flat major/i, "listed under Schubert"],
  ["Shostakovich", /Children's Notebook/i, "beginner pieces, below the catalogue's range"],
  ["Shostakovich", /\(arr\. Auerbach\)/i, "contemporary completion of the Tsyganov set; no recording evidence"],
  ["Shostakovich", /Limpid Stream/i, "only a catalogue listing, no recording evidence"],
  ["Strauss", /^Morgen!/i, "no recording of the Hubay version"],
  ["Sibelius", /^Suite in E major, JS 188/i, "no published edition"],
  ["Szymanowski", /^L'aube/i, "low-confidence, edition not confirmed"],
  ["Vivaldi", /RV (564|575|571|576)\b/i, "four or more soloists (concerto grosso type)"],
  ["Paganini", /^6 Preludes/i, "doubtful attribution"],
  ["Tchaikovsky", /^(Andante funebre|Oh! chante encore)/i, "obscure composer-made arrangements, rarely played"],
];
for (let i = added.length - 1; i >= 0; i--) {
  const e = added[i];
  if (!String(e.uid).startsWith("G")) continue;
  const hit = GAP_DROP.find(([sn, rx]) => e.composer.startsWith(sn) && rx.test(e.title));
  if (hit) {
    dropped.push({ composer: e.composer, uid: e.uid, title: e.title, why: hit[2] });
    added.splice(i, 1);
  }
}

// entries removed after reviewing those pairs and other out-of-scope items (key = composer slug : queue uid)
const MANUAL_DROP: Record<string, string> = {
  "dvorak-antonin:N4": "Kreisler's Slavonic Fantasy is already listed under Kreisler",
  "beethoven-ludwig-van:N6": "Kreisler's Rondino is already listed under Kreisler",
  "elgar-edward:N9": "beginner exercises, below the catalogue's range",
  "elgar-edward:N8": "beginner exercise, below the catalogue's range",
  "auer-leopold:N4": "a graded method spanning beginner to advanced, not a single level",
  "mendelssohn-felix:N1": "generic umbrella entry, no specific pieces",
};
for (let i = added.length - 1; i >= 0; i--) {
  const why = MANUAL_DROP[`${slug(added[i].composer)}:${added[i].uid}`];
  if (why) {
    dropped.push({ composer: added[i].composer, uid: added[i].uid, title: added[i].title, why });
    added.splice(i, 1);
  }
}

// fields corrected after checking against source pages (key = composer slug : queue uid)
//  Vivaldi: IMSLP "12 Concerti, Op.7" lists RV 294a = No. 4, RV 354 = No. 5, RV 285a = No. 9
//  Hubay: Op. 95 has four pieces (the Foundation lists "Drei (Vier) Stücke"), so one set name for all of them
const ENTRY_FIX: Record<string, Partial<Record<"title" | "set" | "minutes", string | number>>> = {
  "vivaldi-antonio:N204": { title: "Concerto in F major, Op. 7 No. 4, RV 294a 'Il ritiro'" },
  "vivaldi-antonio:N260": { title: "Concerto in A minor, Op. 7 No. 5, RV 354" },
  "vivaldi-antonio:N261": { title: "Concerto in F major, Op. 7 No. 9, RV 285a" },
  "hubay-jeno:N65": { set: "Stücke, Op. 95" },
  "hubay-jeno:N66": { set: "Stücke, Op. 95" },
  "hubay-jeno:N67": { set: "Stücke, Op. 95" },
  "scott-cyril:N10": { set: "" }, // the Tallahassee Suite is Op. 73 No. 4 but not part of the "Trois Pièces lyriques"
  // minutes calibrated to the length of the matched complete recording (the first estimates were off by 2x or more)
  "achron-joseph:N12": { minutes: 4 },
  "drdla-franz:N43": { minutes: 5 },
  "hubay-jeno:N1": { minutes: 6 },
  "sarasate-pablo-de:N22": { minutes: 6 },
  "sarasate-pablo-de:N5": { minutes: 11 },
  "sarasate-pablo-de:N7": { minutes: 7 },
  "sibelius-jean:N12": { minutes: 2 },
  "sinding-christian:N7": { minutes: 7 },
  "sinding-christian:N22": { minutes: 6 },
  "vieuxtemps-henri:N19": { minutes: 7 },
  "paganini-niccolo:G:sonata ms 83": { minutes: 20 },
  "paganini-niccolo:G:tema variato ms 82": { minutes: 12 },
  "paganini-niccolo:G:perpetuela b flat ms 66": { minutes: 4 },
};
for (const e of added) Object.assign(e, ENTRY_FIX[`${slug(e.composer)}:${e.uid}`] ?? ENTRY_FIX[`${slug(e.composer)}:G:${normTitle(e.title)}`] ?? {});

// ------------------------------------------------------------------ LEVEL BLEND: first-pass level + blind second opinion (pass 5)
const disagreements: any[] = [];
{
  const p5 = new Map<string, { level: number; confidence: string }>();
  for (const composer of new Set(added.map((e) => e.composer))) {
    const f = maybe<any>(`data/expansion/pass5/${slug(composer)}.json`, null);
    for (const g of f?.grades ?? []) p5.set(`${slug(composer)}:${g.uid}`, g);
  }
  let changed = 0;
  for (const e of added) {
    const g = p5.get(`${slug(e.composer)}:${e.uid}`);
    if (!g) continue;
    const a = e.level as number, b = g.level as number;
    e.level_first = a;
    e.level_second = b;
    if (e.confidence === "high" && Math.abs(a - b) <= 2) continue; // the first grader knew the piece well
    const blended = Math.min(10, Math.max(1, Math.floor((a + b) / 2 + 0.5)));
    if (Math.abs(a - b) >= 2) disagreements.push({ composer: e.composer, uid: e.uid, title: e.title, first: a, second: b, final: blended });
    if (blended !== a) changed++;
    e.level = blended;
  }
  if (p5.size) console.log(`level blend: ${changed} of ${added.length} levels moved; ${disagreements.length} disagreements of 2+ levels`);
  write("data/expansion/final/level-disagreements.json", disagreements);
}

// ------------------------------------------------------------------ build the new rows
const sheetOrder = (c: string) => targets.indexOf(c);
added.sort((a, b) => a.composer.localeCompare(b.composer, "en") || a.category.localeCompare(b.category) || a.title.localeCompare(b.title, "en", { numeric: true }));
// Ids are sticky: an entry keeps the id it was first given (keyed by composer + queue uid), so recordings, tags and
// popularity computed before the web verification finished stay attached even if the list changes afterwards.
const REGISTRY = "data/expansion/id-registry.json";
const registry: Record<string, number> = maybe(REGISTRY, {});
let nextId = Math.max(...rows.map((r) => r.id), ...Object.values(registry)) + 1;
const guide = (lv: number) => {
  const l = levels.find((x) => x.level === lv)!;
  return `${l.name} (${l.exam})`;
};
const composerInfo = new Map(rows.map((r) => [r.composer, r]));
const COL = Object.fromEntries(HEADER.map((h, i) => [h, i]));
const pagesOut: Record<string, string> = {}; // rebuilt from scratch on every run
const newRows: string[][] = [];
// entries graded from the researchers' gaps (uid G…) are keyed by their title, since their numbering can change when a gap list changes
for (const k of Object.keys(registry)) if (/:G\d+$/.test(k)) delete registry[k]; // one-off: early positional keys
const usedKeys = new Set<string>();
for (const e of added) {
  let rkey = String(e.uid).startsWith("G") ? `${slug(e.composer)}:G:${normTitle(e.title)}` : `${slug(e.composer)}:${e.uid}`;
  // normTitle drops parenthetical text, so two arrangements of a differently-sourced piece can collide: the second one gets the full title
  if (usedKeys.has(rkey)) rkey = `${slug(e.composer)}:G:${normFull(e.title)}`;
  for (let n = 2; usedKeys.has(rkey); n++) rkey = `${rkey.replace(/#\d+$/, "")}#${n}`;
  usedKeys.add(rkey);
  e.id = registry[rkey] ?? (registry[rkey] = nextId++);
}
added.sort((a, b) => a.id - b.id);
for (const e of added) {
  const info = composerInfo.get(e.composer)!;
  const r = new Array(HEADER.length).fill("");
  r[COL["Composer"]] = e.composer;
  r[COL["Title"]] = e.title;
  r[COL["Level (1–10)"]] = String(e.level);
  r[COL["Category"]] = e.category;
  r[COL["Accompaniment"]] = e.accompaniment;
  r[COL["Era"]] = info.era;
  r[COL["Dates"]] = info.dates;
  r[COL["Nationality"]] = info.nat;
  r[COL["Composer gender"]] = info.gender;
  r[COL["Level guide"]] = guide(e.level);
  r[COL["Approx. min"]] = e.minutes ? String(e.minutes) : "";
  r[COL["Notes / teaching focus"]] = e.notes ?? "";
  r[COL["Listen"]] = "▶ Listen";
  r[COL["Score"]] = e.imslp_page ? "IMSLP" : "";
  r[COL["ID"]] = String(e.id);
  r[COL["Set"]] = e.set ?? "";
  if (e.imslp_page) pagesOut[String(e.id)] = e.imslp_page.replace(/\s*$/, "");
  newRows.push(r);
}

// existing pages covered by IMSLP items (pass 1) get their exact IMSLP page (not where the match looked wrong in my audit)
const NO_PAGE = new Set([1282]); // Suk, Love Song Op. 7 No. 1: pass 1 had matched it to the Op. 17 pieces
for (const composer of targets) {
  const p1 = maybe<any>(`data/expansion/pass1/${slug(composer)}.json`, { decisions: [] });
  for (const d of p1.decisions) for (const id of d.covered_ids) if (byId.has(id) && !pagesOut[String(id)] && d.covered_ids.length <= 8 && !NO_PAGE.has(id)) pagesOut[String(id)] = d.page;
}

// ------------------------------------------------------------------ apply edits to existing rows (+ merges)
const idx = (name: string) => values[0].indexOf(name);
const FIELD_COL: Record<string, number> = { title: idx("Title"), level: idx("Level (1–10)"), category: idx("Category"), acc: idx("Accompaniment"), min: idx("Approx. min"), set: idx("Set"), notes: idx("Notes / teaching focus") };
const removeIds = new Set(merges.map((m) => m.remove));
const outValues: string[][] = [values[0]];
for (const [i, row] of values.slice(1).entries()) {
  const r = rows[i];
  if (removeIds.has(r.id)) {
    const m = merges.find((x) => x.remove === r.id)!;
    // keep the exam listings of the merged-away entry
    const keepRow = values.slice(1)[rows.findIndex((x) => x.id === m.keep)];
    const mergedExams = [...new Set([...(keepRow[idx("Exam & syllabus lists")] ?? "").split(" · "), ...(row[idx("Exam & syllabus lists")] ?? "").split(" · ")].filter(Boolean))].join(" · ");
    setEdit(m.keep, "__exams", mergedExams);
    continue;
  }
  outValues.push(row);
}
for (const row of outValues.slice(1)) {
  const id = Number(row[idx("ID")]);
  const e = edits.get(id);
  if (!e) continue;
  for (const [k, v] of Object.entries(e)) {
    if (k === "__exams") row[idx("Exam & syllabus lists")] = String(v);
    else row[FIELD_COL[k]] = String(v);
  }
  row[idx("Level guide")] = guide(Number(row[idx("Level (1–10)")]));
}
const finalValues = [...outValues, ...newRows];

// ------------------------------------------------------------------ report + outputs
write("data/expansion/final/added.json", added);
write("data/expansion/final/changes.json", changes);
write("data/expansion/final/merges.json", merges);
write("data/expansion/final/dropped.json", dropped);
const cnt = (f: (c: Change) => boolean) => changes.filter(f).length;
console.log(
  `new entries ${added.length}; dropped ${dropped.length}; audit suggestions on existing rows ${changes.length} (applied ${cnt((c) => c.applied)}); merged duplicates ${merges.length}; ` +
    `rows ${rows.length} -> ${finalValues.length - 1}; direct IMSLP links ${Object.keys(pagesOut).length}`,
);
const byComposer = new Map<string, number>();
for (const e of added) byComposer.set(e.composer, (byComposer.get(e.composer) ?? 0) + 1);
console.log([...byComposer.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c.split(",")[0]} ${n}`).join(", "));

if (WRITE) {
  // the live snapshot (data/source/all-repertoire.json) is only replaced when the expansion is promoted
  write("data/expansion/final/all-repertoire.next.json", JSON.stringify({ range: `'All Repertoire'!A1:U${finalValues.length}`, values: finalValues }));
  write(REGISTRY, registry);
  write("data/imslp-pages.json", pagesOut);
  write("data/id-merges.json", Object.fromEntries(merges.map((m) => [String(m.remove), m.keep])));
  console.log("wrote data/expansion/final/all-repertoire.next.json");
}
void sheetOrder;
void ({} as Row);
