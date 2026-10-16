import type { EraKey, Popularity } from "../types";

/** who plays: the chamber section's main facet (the violin section's "setting") */
export type FormationKey =
  | "string-trio"
  | "string-quartet"
  | "string-quintet"
  | "large-strings" // sextets to nonets for strings alone
  | "piano-trio" // violin, cello, piano
  | "piano-quartet" // violin, viola, cello, piano
  | "piano-quintet" // string quartet (or violin, viola, cello, bass) and piano
  | "piano-strings" // any other piano-and-strings scoring
  | "winds-strings" // at least one wind or brass instrument, with or without piano
  | "continuo" // baroque trio and quartet sonatas
  | "other"; // strings with harp, guitar, voice, percussion …

/** work = a complete work, or a single movement over about 12 minutes · short = a shorter single piece · set = a collection of pieces */
export type FormKey = "work" | "short" | "set";

export type InstrumentKey =
  | "violin"
  | "viola"
  | "cello"
  | "double-bass"
  | "viola-da-gamba"
  | "viola-damore"
  | "piano"
  | "harpsichord"
  | "organ"
  | "harmonium"
  | "celesta"
  | "continuo" // a basso continuo part (keyboard, with or without a bass instrument): one player
  | "flute"
  | "recorder"
  | "oboe"
  | "english-horn"
  | "clarinet"
  | "bass-clarinet"
  | "basset-horn"
  | "bassoon"
  | "saxophone"
  | "horn"
  | "trumpet"
  | "trombone"
  | "tuba"
  | "harp"
  | "guitar"
  | "lute"
  | "mandolin"
  | "accordion"
  | "percussion"
  | "voice"
  | "electronics"; // tape or live electronics: not a player

/** "balanced" (no part clearly harder), an instrument ("piano"), or a numbered part when there are several ("violin 1") */
export type HardestPart = string;

/** One work as stored in data/chamber/works.json (the section's source of truth). */
export interface ChamberWork {
  id: number; // 100001 up
  composer: string; // "Last, First", spelled as in the violin catalogue
  title: string; // house style; nickname in ("…") at the end
  aka?: string[]; // other names people search for ("Der Tod und das Mädchen")
  formation: FormationKey;
  formationNote?: string; // why `formation` differs from formationFor(instruments)
  instruments: Partial<Record<InstrumentKey, number>>;
  alternatives?: Partial<Record<InstrumentKey, InstrumentKey[]>>; // published alternatives for a part: Kegelstatt {clarinet: ["violin"]}
  optional?: Partial<Record<InstrumentKey, number>>; // ad lib. parts, not counted in players or formation: K. 525 {"double-bass": 1}
  players: number; // parts: continuo counts as one, electronics as none
  form: FormKey;
  level: number; // 1–10, the violin catalogue's scale (see docs/chamber-music-plan.md)
  hardestPart: HardestPart;
  era?: EraKey; // only when it differs from the composer's
  year: string;
  minutes: number | null;
  set: string | null;
  notes: string;
  popularity: Popularity | null;
  mode?: "major" | "minor" | null;
  pace?: "slow" | "moderate" | "lively" | null;
  character?: string[];
  imslpPage?: string;
  violinId?: number; // the same work in the violin catalogue (title and level must match)
  benchmark?: "proposed" | "approved";
  basis?: string; // benchmarks: why this level
}

/** data/chamber/composers.json: composers who have no violin entries (the others take their metadata from the violin rows) */
export interface ChamberComposer {
  dates: string;
  nationality: string;
  gender: "F" | "M" | "";
  era: EraKey;
}
