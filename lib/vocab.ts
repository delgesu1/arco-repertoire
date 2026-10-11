import type { EraKey, SettingKey, TypeKey } from "./types";

/** the line under the work count at the top of the home page (also shown by the loading skeleton, so the two must match) */
export const INTRO =
  "graded works for the violin, sorted by setting, level and character, with sheet music links, YouTube playback, and a smart AI advisor you can chat with to find the perfect piece for you.";

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

/**
 * How the finder's choices read in a sentence: "Show me sonatas WITH piano at level 6", "...FOR solo violin around level 4",
 * "any piece IN any setting at any level". One place, so the sentence at the top and the results heading under it agree.
 * (The Record type means a new setting cannot be added without saying how it reads.)
 */
export const SETTING_PHRASE: Record<SettingKey, { lead: "with" | "for"; noun: string }> = {
  solo: { lead: "for", noun: "solo violin" },
  piano: { lead: "with", noun: "piano" },
  orchestra: { lead: "with", noun: "orchestra" },
  duo: { lead: "for", noun: "two or more violins" },
  continuo: { lead: "with", noun: "continuo" },
  other: { lead: "for", noun: "other ensembles" },
};
export const settingPhrase = (k: SettingKey | null): { lead: string; noun: string } =>
  k ? SETTING_PHRASE[k] : { lead: "in", noun: "any setting" };
/** the type as a plural noun phrase ("concertos", "études & caprices"), or "any piece" */
export const typePhrase = (k: TypeKey | null): string => (k ? (TYPES.find((t) => t.key === k)?.label ?? k).toLowerCase() : "any piece");
/** "at level 5", "around level 5" (the neighbouring levels count too) or "at any level" */
export const levelPhrase = (level: number | null, exact: boolean): { lead: string; noun: string } =>
  level ? { lead: exact ? "at" : "around", noun: `level ${level}` } : { lead: "at", noun: "any level" };
/** the whole sentence, as plain text (the page renders the same parts as menus) */
export const finderSentence = (type: TypeKey | null, setting: SettingKey | null, level: number | null, exact: boolean): string => {
  const s = settingPhrase(setting);
  const l = levelPhrase(level, exact);
  return `Show me ${typePhrase(type)} ${s.lead} ${s.noun} ${l.lead} ${l.noun}`;
};
/** the heading over the results: "Concertos with orchestra", "Pieces for solo violin" (no type chosen → "Pieces") */
export const resultsHeading = (type: TypeKey | null, setting: SettingKey | null): string => {
  if (!type && !setting) return "";
  const label = type ? (TYPES.find((t) => t.key === type)?.label ?? type) : "Pieces";
  return setting ? `${label} ${settingPhrase(setting).lead} ${settingPhrase(setting).noun}` : label;
};

export const EXAM_BOARDS = ["ABRSM", "Trinity", "RCM", "AMEB", "ASTA", "NYSSMA", "UIL", "Henle"] as const;

export const settingLabel = (k: SettingKey) => SETTINGS.find((s) => s.key === k)?.label ?? k;
export const typeLabel = (k: TypeKey) => TYPES.find((t) => t.key === k)?.label ?? k;
export const typeSingular = (k: TypeKey) => TYPES.find((t) => t.key === k)?.singular ?? k;
export const eraLabel = (k: EraKey) => ERAS.find((e) => e.key === k)?.label ?? k;
