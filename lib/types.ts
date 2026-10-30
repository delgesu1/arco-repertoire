import type { ChamberFacts, InstrumentKey, PartLevels } from "./chamber/types";

export type SettingKey = "solo" | "piano" | "orchestra" | "continuo" | "duo" | "other";
export type TypeKey =
  | "concerto"
  | "sonata"
  | "short"
  | "showpiece"
  | "concertpiece"
  | "suite"
  | "solo"
  | "duet"
  | "etude"
  | "technique";
export type EraKey = "baroque" | "classical" | "early-romantic" | "late-romantic" | "20th-century" | "contemporary";
export type Popularity = "well-known" | "lesser-known";

export interface Recording {
  id: string;
  title: string;
  channel: string;
  seconds: number | null;
  alternates: string[];
}

/** the ensembles a violin work may be accompanied by, beside the chamber section's instruments */
export type EnsembleKey = "orchestra" | "string-orchestra" | "ensemble";
export type PartKey = InstrumentKey | EnsembleKey;
/** a work's whole scoring, the violin part included: instrument or ensemble → how many */
export type Scoring = Partial<Record<PartKey, number>>;

/** the site's sections: the violin catalogue and chamber music (docs/chamber-music-plan.md) */
export type SectionKey = "violin" | "chamber";

/** What every work has, whichever section lists it. */
export interface PieceBase {
  id: number;
  slug: string;
  composer: string; // "Last, First"
  composerName: string; // "First Last"
  composerSlug: string;
  title: string;
  /** Arranger's display name ("Klaus Trumpf"), separate from the source work's composer. */
  arranger?: string;
  level: number;
  era: EraKey;
  dates: string;
  nationality: string;
  gender: "F" | "M" | "";
  minutes: number | null;
  notes: string;
  imslpPage?: string; // title of the work's own IMSLP page; absent when IMSLP has none (see data/imslp-pages.json)
  set: string | null;
  setKey: string | null;
  mode: "major" | "minor" | null;
  pace: "slow" | "moderate" | "lively" | null;
  character: string[];
  popularity: Popularity | null;
  /** how famous the work is, for the "Best known" order: higher first (scripts/fame.ts) */
  fame: number;
  recording: Recording | null;
  /** the sections that list the work; left out of the violin catalogue's rows, which are violin only unless the chamber data says otherwise */
  sections?: SectionKey[];
  /** the chamber section's facets, on every work the chamber section lists */
  chamber?: ChamberFacts;
  /** each part's own level, where the parts are graded separately (the duos in both sections): {"violin": 7, "piano": 8}.
   * The violin section shows the violin part's, the chamber section the hardest part's */
  partLevels?: PartLevels;
  /** other titles the work is known by (IMSLP or research, data/details/works.json): searched, not shown */
  alsoTitled?: string[];
}

/** A work in the violin catalogue. */
export interface Piece extends PieceBase {
  type: TypeKey;
  settings: SettingKey[];
  accompaniment: string; // raw text from the Sheet
  /** the whole scoring (data/instrumentation-map.json by accompaniment, or the chamber entry of a work in both sections) */
  instruments: Scoring;
  alternatives?: Partial<Record<PartKey, PartKey[]>>; // published substitutes: "Piano or orchestra" {piano: ["orchestra"]}
  optional?: Scoring; // ad lib. parts
  exams: string;
  examBoards: string[];
}

export interface LevelInfo {
  level: number;
  name: string;
  exam: string;
}

export interface Catalogue {
  version: string;
  levels: LevelInfo[];
  levelNote: string;
  pieces: Piece[];
}
