import type { EraKey, SettingKey, TypeKey } from "./types";

export const SETTINGS: { key: SettingKey; label: string; short: string }[] = [
  { key: "solo", label: "Unaccompanied", short: "Solo" },
  { key: "piano", label: "With piano", short: "Piano" },
  { key: "orchestra", label: "With orchestra", short: "Orchestra" },
  { key: "duo", label: "Two or more violins", short: "Violins" },
  { key: "continuo", label: "With continuo", short: "Continuo" },
  { key: "other", label: "Other ensembles", short: "Other" },
];

export const TYPES: { key: TypeKey; label: string; singular: string; sheet: string }[] = [
  { key: "concerto", label: "Concertos", singular: "Concerto", sheet: "Concerto" },
  { key: "sonata", label: "Sonatas & duos", singular: "Sonata", sheet: "Sonata / Duo (vln & pno)" },
  { key: "short", label: "Short pieces", singular: "Short piece", sheet: "Short Piece" },
  { key: "showpiece", label: "Showpieces", singular: "Showpiece", sheet: "Virtuoso Showpiece" },
  { key: "concertpiece", label: "Concert pieces", singular: "Concert piece", sheet: "Concert Piece (orch.)" },
  { key: "suite", label: "Suites & sets", singular: "Suite", sheet: "Suite / Set" },
  { key: "solo", label: "Solo works", singular: "Solo work", sheet: "Solo Violin" },
  { key: "duet", label: "Duets & doubles", singular: "Duet", sheet: "Duet / Double Concerto" },
  { key: "etude", label: "Études & caprices", singular: "Étude", sheet: "Études & Caprices" },
  { key: "technique", label: "Technique", singular: "Technique", sheet: "Technique & Scales" },
];

export const ERAS: { key: EraKey; label: string; sheet: string }[] = [
  { key: "baroque", label: "Baroque", sheet: "Baroque" },
  { key: "classical", label: "Classical", sheet: "Classical" },
  { key: "early-romantic", label: "Early Romantic", sheet: "Early Romantic" },
  { key: "late-romantic", label: "Late Romantic", sheet: "Late Romantic" },
  { key: "20th-century", label: "20th century", sheet: "20th Century" },
  { key: "contemporary", label: "Contemporary", sheet: "Contemporary" },
];

export const PACE = ["slow", "moderate", "lively"] as const;
export const CHARACTER = [
  "lyrical",
  "dance",
  "virtuosic",
  "playful",
  "dramatic",
  "tender",
  "dark",
  "folk",
  "heroic",
  "humorous",
] as const;

export const EXAM_BOARDS = ["ABRSM", "Trinity", "RCM", "AMEB", "ASTA", "NYSSMA", "UIL", "Henle"] as const;

export const settingLabel = (k: SettingKey) => SETTINGS.find((s) => s.key === k)?.label ?? k;
export const typeLabel = (k: TypeKey) => TYPES.find((t) => t.key === k)?.label ?? k;
export const typeSingular = (k: TypeKey) => TYPES.find((t) => t.key === k)?.singular ?? k;
export const eraLabel = (k: EraKey) => ERAS.find((e) => e.key === k)?.label ?? k;
