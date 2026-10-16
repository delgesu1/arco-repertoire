import type { FormKey, FormationKey, InstrumentKey } from "./types";

export const FORMATIONS: { key: FormationKey; label: string; singular: string }[] = [
  { key: "string-trio", label: "String trios", singular: "String trio" },
  { key: "string-quartet", label: "String quartets", singular: "String quartet" },
  { key: "string-quintet", label: "String quintets", singular: "String quintet" },
  { key: "large-strings", label: "Sextets & octets", singular: "String sextet or larger" },
  { key: "piano-trio", label: "Piano trios", singular: "Piano trio" },
  { key: "piano-quartet", label: "Piano quartets", singular: "Piano quartet" },
  { key: "piano-quintet", label: "Piano quintets", singular: "Piano quintet" },
  { key: "piano-strings", label: "Other piano & strings", singular: "Piano & strings" },
  { key: "winds-strings", label: "Strings & winds", singular: "Strings & winds" },
  { key: "continuo", label: "With continuo", singular: "With continuo" },
  { key: "other", label: "Other ensembles", singular: "Other ensemble" },
];

export const FORMS: { key: FormKey; label: string }[] = [
  { key: "work", label: "Full works" },
  { key: "short", label: "Short pieces" },
  { key: "set", label: "Sets of pieces" },
];

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

type Instrumentation = Partial<Record<InstrumentKey, number>>;
const entries = (ins: Instrumentation) => Object.entries(ins) as [InstrumentKey, number][];
const count = (ins: Instrumentation, family: Family) =>
  entries(ins).reduce((n, [k, c]) => n + (INSTRUMENTS[k].family === family ? c : 0), 0);

/** the number of parts: continuo is one player, electronics none */
export const playersFor = (ins: Instrumentation): number =>
  entries(ins).reduce((n, [k, c]) => n + (INSTRUMENTS[k].family === "electronics" ? 0 : c), 0);

/**
 * The formation a scoring belongs to, checked in this order: continuo → any wind or brass → harp, guitar, voice and the
 * like → piano with strings → strings alone. Electronics never change it. A stored formation may differ only with a
 * formationNote (Schoenberg's Second Quartet is a string quartet although a soprano joins it).
 */
export function formationFor(ins: Instrumentation): FormationKey {
  if (count(ins, "continuo")) return "continuo";
  if (count(ins, "wind")) return "winds-strings";
  if (count(ins, "other")) return "other";
  const strings = count(ins, "string");
  const n = (k: InstrumentKey) => ins[k] ?? 0;
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

const named = (k: InstrumentKey, c: number) => (c > 1 ? `${c} ${INSTRUMENTS[k].plural ?? `${INSTRUMENTS[k].label}s`}` : INSTRUMENTS[k].label);
const or = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}` : xs[0]);

/**
 * "2 violins, viola, cello", "clarinet (or violin), viola, piano", "2 violins, viola, cello, double bass ad lib."
 * (instruments in the work's own order, then the ad lib. parts)
 */
export const instrumentList = (
  ins: Instrumentation,
  extra: { alternatives?: Partial<Record<InstrumentKey, InstrumentKey[]>>; optional?: Instrumentation } = {},
): string =>
  [
    ...entries(ins).map(([k, c]) => {
      const alt = extra.alternatives?.[k];
      return alt?.length ? `${named(k, c)} (or ${or(alt.map((a) => INSTRUMENTS[a].label))})` : named(k, c);
    }),
    ...entries(extra.optional ?? {}).map(([k, c]) => `${named(k, c)} ad lib.`),
  ].join(", ");

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
