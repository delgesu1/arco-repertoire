import { levelPhrase } from "../vocab";
import type { FormKey, FormationKey, HardestPart, InstrumentKey, Instrumentation } from "./types";

/** what Atlas is, beside the counts at the top of /chamber (components/Ledger.tsx; the loading skeleton shows it too) */
export const CHAMBER_INTRO = "Arco Atlas is a free and open catalogue of chamber works, searchable every way you’d want.";

/** what a level means here, for the "How the 10 levels work" popover (docs/chamber-music-plan.md, decision 2) */
export const CHAMBER_LEVEL_NOTE =
  "A chamber work's level is the level its hardest part asks of its player, on the violin scale, raised by up to one when the ensemble asks more than the notes do. For piano, wind and other parts, read it as the same exam grade on that instrument.";

export const FORMATIONS: { key: FormationKey; label: string; singular: string }[] = [
  { key: "duo-piano", label: "Violin & piano", singular: "Violin & piano duo" },
  { key: "duo-strings", label: "String duos", singular: "String duo" },
  { key: "duo-other", label: "Violin & guitar or harp", singular: "Duo with guitar or harp" },
  { key: "string-trio", label: "String trios", singular: "String trio" },
  { key: "string-quartet", label: "String quartets", singular: "String quartet" },
  { key: "string-quintet", label: "String quintets", singular: "String quintet" },
  { key: "large-strings", label: "Sextets & octets", singular: "String sextet or larger" },
  { key: "same-instrument", label: "Same instrument", singular: "Same-instrument ensemble" },
  { key: "viol-consort", label: "Viol consorts", singular: "Viol consort" },
  { key: "piano-trio", label: "Piano trios", singular: "Piano trio" },
  { key: "piano-quartet", label: "Piano quartets", singular: "Piano quartet" },
  { key: "piano-quintet", label: "Piano quintets", singular: "Piano quintet" },
  { key: "piano-strings", label: "Other piano & strings", singular: "Piano & strings" },
  { key: "winds-strings", label: "Strings & winds", singular: "Strings & winds" },
  { key: "continuo", label: "With continuo", singular: "With continuo" },
  { key: "other", label: "Other ensembles", singular: "Other ensemble" },
];

/** the ensemble menu's groups, each in FORMATIONS order */
export const FORMATION_GROUPS: { label: string; keys: FormationKey[] }[] = [
  { label: "Duos", keys: ["duo-piano", "duo-strings", "duo-other"] },
  { label: "Strings", keys: ["string-trio", "string-quartet", "string-quintet", "large-strings", "same-instrument", "viol-consort"] },
  { label: "Piano and strings", keys: ["piano-trio", "piano-quartet", "piano-quintet", "piano-strings"] },
  { label: "Mixed", keys: ["winds-strings", "continuo", "other"] },
];

export const FORMS: { key: FormKey; label: string; singular: string }[] = [
  { key: "work", label: "Full works", singular: "Full work" },
  { key: "short", label: "Short pieces", singular: "Short piece" },
  { key: "set", label: "Sets of pieces", singular: "Set of pieces" },
];

/**
 * How the chamber finder reads: "Show me short pieces FOR string quartet around level 3", "any piece WITH continuo",
 * "any piece FOR any ensemble at any level" (the violin finder's SETTING_PHRASE, for formations).
 */
export const FORMATION_PHRASE: Record<FormationKey, { lead: "for" | "with"; noun: string }> = {
  "duo-piano": { lead: "for", noun: "violin & piano" },
  "duo-strings": { lead: "for", noun: "string duo" },
  "duo-other": { lead: "for", noun: "violin & guitar or harp" },
  "string-trio": { lead: "for", noun: "string trio" },
  "string-quartet": { lead: "for", noun: "string quartet" },
  "string-quintet": { lead: "for", noun: "string quintet" },
  "large-strings": { lead: "for", noun: "string sextet or larger" },
  "same-instrument": { lead: "for", noun: "same-instrument ensemble" },
  "viol-consort": { lead: "for", noun: "viol consort" },
  "piano-trio": { lead: "for", noun: "piano trio" },
  "piano-quartet": { lead: "for", noun: "piano quartet" },
  "piano-quintet": { lead: "for", noun: "piano quintet" },
  "piano-strings": { lead: "for", noun: "piano & strings" },
  "winds-strings": { lead: "for", noun: "strings & winds" },
  continuo: { lead: "with", noun: "continuo" },
  other: { lead: "for", noun: "other ensembles" },
};
export const formationPhrase = (k: FormationKey | null): { lead: string; noun: string } =>
  k ? FORMATION_PHRASE[k] : { lead: "for", noun: "any ensemble" };
/** the form as a plural noun phrase ("short pieces"), or "any piece" */
export const formPhrase = (k: FormKey | null): string => (k ? (FORMS.find((f) => f.key === k)?.label ?? k).toLowerCase() : "any piece");
/** the whole sentence, as plain text (the page renders the same parts as menus) */
export const chamberSentence = (form: FormKey | null, formation: FormationKey | null, level: number | null, exact: boolean): string => {
  const e = formationPhrase(formation);
  const l = levelPhrase(level, exact);
  return `Show me ${formPhrase(form)} ${e.lead} ${e.noun} ${l.lead} ${l.noun}`;
};
/** the heading over the results: "Short pieces for string quartet", "Pieces with continuo" (nothing chosen → "") */
export const chamberHeading = (form: FormKey | null, formation: FormationKey | null): string => {
  if (!form && !formation) return "";
  const label = form ? (FORMS.find((f) => f.key === form)?.label ?? form) : "Pieces";
  return formation ? `${label} ${FORMATION_PHRASE[formation].lead} ${FORMATION_PHRASE[formation].noun}` : label;
};
export const formSingular = (k: FormKey) => FORMS.find((f) => f.key === k)?.singular ?? k;
export const formationSingular = (k: FormationKey) => FORMATIONS.find((f) => f.key === k)?.singular ?? k;

type Family = "string" | "keyboard" | "continuo" | "wind" | "other" | "electronics";

/** Every instrument with its label and family (the Record type means a new instrument cannot be added without both). */
export const INSTRUMENTS: Record<InstrumentKey, { label: string; family: Family; plural?: string }> = {
  violin: { label: "violin", family: "string" },
  viola: { label: "viola", family: "string" },
  cello: { label: "cello", family: "string" },
  "double-bass": { label: "double bass", family: "string", plural: "double basses" },
  "viola-da-gamba": { label: "viola da gamba", family: "string", plural: "violas da gamba" },
  "viola-damore": { label: "viola d'amore", family: "string", plural: "violas d'amore" },
  piano: { label: "piano", family: "keyboard" },
  harpsichord: { label: "harpsichord", family: "other" },
  organ: { label: "organ", family: "other" },
  harmonium: { label: "harmonium", family: "other" },
  celesta: { label: "celesta", family: "other" },
  continuo: { label: "continuo", family: "continuo", plural: "continuo" },
  flute: { label: "flute", family: "wind" },
  recorder: { label: "recorder", family: "wind" },
  oboe: { label: "oboe", family: "wind" },
  "english-horn": { label: "English horn", family: "wind" },
  clarinet: { label: "clarinet", family: "wind" },
  "bass-clarinet": { label: "bass clarinet", family: "wind" },
  "basset-horn": { label: "basset horn", family: "wind" },
  bassoon: { label: "bassoon", family: "wind" },
  saxophone: { label: "saxophone", family: "wind" },
  horn: { label: "horn", family: "wind" },
  trumpet: { label: "trumpet", family: "wind" },
  trombone: { label: "trombone", family: "wind" },
  tuba: { label: "tuba", family: "wind" },
  harp: { label: "harp", family: "other" },
  guitar: { label: "guitar", family: "other" },
  lute: { label: "lute", family: "other" },
  mandolin: { label: "mandolin", family: "other" },
  accordion: { label: "accordion", family: "other" },
  percussion: { label: "percussion", family: "other", plural: "percussion" },
  voice: { label: "voice", family: "other" },
  electronics: { label: "electronics", family: "electronics", plural: "electronics" },
};

/** "Double bass", "Viola d'amore": an instrument as a chip or menu label */
export const instrumentName = (k: InstrumentKey) => INSTRUMENTS[k].label.charAt(0).toUpperCase() + INSTRUMENTS[k].label.slice(1);

/** the tooltip on the part named under a level pebble ("violin 1", "piano", "balanced") */
export const hardestPartTitle = (level: number, h: HardestPart) =>
  h === "balanced" ? `Level ${level}; no part is clearly harder than the others` : `Level ${level}, set by the ${h} part`;
const entries = (ins: Instrumentation) => Object.entries(ins) as [InstrumentKey, number][];
const count = (ins: Instrumentation, family: Family) =>
  entries(ins).reduce((n, [k, c]) => n + (INSTRUMENTS[k].family === family ? c : 0), 0);

/** the parts by the names hardestPart and partLevels use: "piano", or "violin 1", "violin 2" when there are several */
export const partNames = (ins: Instrumentation): string[] =>
  entries(ins)
    .filter(([k]) => INSTRUMENTS[k].family !== "electronics")
    .flatMap(([k, c]) => (c > 1 ? Array.from({ length: c }, (_, i) => `${k} ${i + 1}`) : [k]));

/** the number of parts: continuo is one player, electronics none */
export const playersFor = (ins: Instrumentation): number =>
  entries(ins).reduce((n, [k, c]) => n + (INSTRUMENTS[k].family === "electronics" ? 0 : c), 0);

export const SAME_INSTRUMENT_STRINGS: InstrumentKey[] = ["violin", "viola", "cello", "double-bass"];

/** the one instrument of a same-instrument ensemble (electronics are not a part), or null for any other scoring */
export const sameInstrument = (ins: Instrumentation): InstrumentKey | null => {
  const parts = entries(ins).filter(([k]) => INSTRUMENTS[k].family !== "electronics");
  return parts.length === 1 && parts[0][1] >= 3 && SAME_INSTRUMENT_STRINGS.includes(parts[0][0]) ? parts[0][0] : null;
};

const GROUP_NAMES: Record<number, string> = { 3: "trio", 4: "quartet", 5: "quintet", 6: "sextet", 7: "septet", 8: "octet", 9: "nonet" };

/**
 * The formation a scoring belongs to, checked in this order: continuo → two players (with a keyboard, two strings, or
 * anything else) → any wind or brass → a consort of viols → harp, guitar, voice and the like → one kind of string instrument
 * alone → piano with strings → strings alone. Electronics never change it. A stored formation may differ only with a formationNote (Schoenberg's Second Quartet
 * is a string quartet although a soprano joins it).
 */
export function formationFor(ins: Instrumentation): FormationKey {
  if (count(ins, "continuo")) return "continuo";
  if (playersFor(ins) === 2) {
    if (entries(ins).some(([k]) => k === "piano" || k === "harpsichord" || k === "organ")) return "duo-piano";
    return count(ins, "string") === 2 ? "duo-strings" : "duo-other";
  }
  if (count(ins, "wind")) return "winds-strings";
  const strings = count(ins, "string");
  const n = (k: InstrumentKey) => ins[k] ?? 0;
  // viols alone, or with the chamber organ or harpsichord of the English consort repertoire (Jenkins, Lawes, Purcell)
  const viols = n("viola-da-gamba");
  if (viols >= 3 && viols === strings && entries(ins).every(([k]) => k === "viola-da-gamba" || k === "organ" || k === "harpsichord"))
    return "viol-consort";
  if (count(ins, "other")) return "other";
  if (sameInstrument(ins)) return "same-instrument";
  const piano = n("piano");
  if (piano === 1) {
    if (strings === 2 && n("violin") === 1 && n("cello") === 1) return "piano-trio";
    if (strings === 3 && n("violin") === 1 && n("viola") === 1 && n("cello") === 1) return "piano-quartet";
    // the usual quintet, or the "Trout" scoring with a bass instead of the second violin
    if (strings === 4 && n("viola") === 1 && n("cello") === 1 && n("violin") + n("double-bass") === 2 && n("violin") >= 1)
      return "piano-quintet";
    return "piano-strings";
  }
  if (piano > 1) return "piano-strings";
  if (strings === 3) return "string-trio";
  if (strings === 4) return "string-quartet";
  if (strings === 5) return "string-quintet";
  return "large-strings";
}

export const formationLabel = (k: FormationKey) => FORMATIONS.find((f) => f.key === k)?.label ?? k;

/** What to call one work's ensemble: its formation's name, or for one kind of instrument "Cello quartet", "Double bass octet" */
export const ensembleLabel = (c: { formation: FormationKey; instruments: Instrumentation }): string => {
  const one = c.formation === "same-instrument" ? sameInstrument(c.instruments) : null;
  return one ? `${instrumentName(one)} ${GROUP_NAMES[playersFor(c.instruments)] ?? "ensemble"}` : formationSingular(c.formation);
};

/** the instruments that take part in any of `works` (electronics are not a part), most works first, then in INSTRUMENTS order */
export const instrumentsByUse = (works: { chamber: { instruments: Instrumentation; alternatives?: Partial<Record<InstrumentKey, InstrumentKey[]>>; optional?: Instrumentation } }[]): { key: InstrumentKey; works: number }[] => {
  const n = new Map<InstrumentKey, number>();
  for (const w of works) for (const k of playableBy(w.chamber)) n.set(k, (n.get(k) ?? 0) + 1);
  const order = Object.keys(INSTRUMENTS) as InstrumentKey[];
  return order
    .filter((k) => n.has(k) && INSTRUMENTS[k].family !== "electronics")
    .map((k) => ({ key: k, works: n.get(k)! }))
    .sort((a, b) => b.works - a.works || order.indexOf(a.key) - order.indexOf(b.key));
};

const named = (k: InstrumentKey, c: number) => (c > 1 ? `${c} ${INSTRUMENTS[k].plural ?? `${INSTRUMENTS[k].label}s`}` : INSTRUMENTS[k].label);
const or = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}` : xs[0]);

/** the scoring part by part: [{ name: "clarinet", note: "(or violin)" }, { name: "viola" }, …, { name: "double bass", note: "ad lib." }] */
export const instrumentParts = (
  ins: Instrumentation,
  extra: { alternatives?: Partial<Record<InstrumentKey, InstrumentKey[]>>; optional?: Instrumentation } = {},
): { name: string; note?: string }[] => [
  ...entries(ins).map(([k, c]) => {
    const alt = extra.alternatives?.[k];
    return alt?.length ? { name: named(k, c), note: `(or ${or(alt.map((a) => INSTRUMENTS[a].label))})` } : { name: named(k, c) };
  }),
  ...entries(extra.optional ?? {}).map(([k, c]) => ({ name: named(k, c), note: "ad lib." })),
];

/**
 * "2 violins, viola, cello", "clarinet (or violin), viola, piano", "2 violins, viola, cello, double bass ad lib."
 * (instruments in the work's own order, then the ad lib. parts)
 */
export const instrumentList = (
  ins: Instrumentation,
  extra: { alternatives?: Partial<Record<InstrumentKey, InstrumentKey[]>>; optional?: Instrumentation } = {},
): string => instrumentParts(ins, extra).map((x) => (x.note ? `${x.name} ${x.note}` : x.name)).join(", ");

/** every instrument that can take part: the scoring, its published alternatives and its ad lib. parts (for "includes instrument") */
export const playableBy = (w: {
  instruments: Instrumentation;
  alternatives?: Partial<Record<InstrumentKey, InstrumentKey[]>>;
  optional?: Instrumentation;
}): Set<InstrumentKey> =>
  new Set([
    ...(Object.keys(w.instruments) as InstrumentKey[]),
    ...Object.values(w.alternatives ?? {}).flat(),
    ...(Object.keys(w.optional ?? {}) as InstrumentKey[]),
  ]);
