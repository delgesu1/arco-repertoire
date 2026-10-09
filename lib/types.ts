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

export interface Piece {
  id: number;
  slug: string;
  composer: string; // "Last, First"
  composerName: string; // "First Last"
  composerSlug: string;
  title: string;
  level: number;
  type: TypeKey;
  settings: SettingKey[];
  accompaniment: string; // raw text from the Sheet
  era: EraKey;
  dates: string;
  nationality: string;
  gender: "F" | "M" | "";
  minutes: number | null;
  notes: string;
  exams: string;
  examBoards: string[];
  imslp: boolean;
  set: string | null;
  setKey: string | null;
  mode: "major" | "minor" | null;
  pace: "slow" | "moderate" | "lively" | null;
  character: string[];
  popularity: Popularity | null;
  recording: Recording | null;
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
