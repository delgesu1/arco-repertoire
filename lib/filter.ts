import type { EraKey, Piece, SettingKey, TypeKey } from "./types";

export interface Filters {
  q: string;
  type: TypeKey | null;
  setting: SettingKey | null;
  level: number | null;
  exact: boolean; // false = around (±1)
  mode: "major" | "minor" | null;
  pace: "slow" | "moderate" | "lively" | null;
  character: string[];
  popularity: "well-known" | "lesser-known" | null;
  minMin: number | null;
  maxMin: number | null;
  era: EraKey | null;
  gender: "F" | "M" | null;
  board: string | null;
  sort: "level" | "composer" | "length" | "relevance";
}

export const EMPTY_FILTERS: Filters = {
  q: "",
  type: null,
  setting: null,
  level: null,
  exact: false,
  mode: null,
  pace: null,
  character: [],
  popularity: null,
  minMin: null,
  maxMin: null,
  era: null,
  gender: null,
  board: null,
  sort: "composer",
};

type Facet = "type" | "setting" | "level" | "mode" | "pace" | "character" | "popularity" | "era" | "gender" | "board" | "length";

/** All filters except `skip` — used for facet counts, so each option shows what you'd get by choosing it. */
export function matches(p: Piece, f: Filters, skip?: Facet): boolean {
  if (skip !== "type" && f.type && p.type !== f.type) return false;
  if (skip !== "setting" && f.setting && !p.settings.includes(f.setting)) return false;
  if (skip !== "level" && f.level != null) {
    if (f.exact ? p.level !== f.level : Math.abs(p.level - f.level) > 1) return false;
  }
  if (skip !== "mode" && f.mode && p.mode !== f.mode) return false;
  if (skip !== "pace" && f.pace && p.pace !== f.pace) return false;
  if (skip !== "character" && f.character.length && !f.character.every((c) => p.character.includes(c))) return false;
  if (skip !== "popularity" && f.popularity && p.popularity !== f.popularity) return false;
  if (skip !== "length") {
    if (f.minMin != null && (p.minutes == null || p.minutes < f.minMin)) return false;
    if (f.maxMin != null && (p.minutes == null || p.minutes > f.maxMin)) return false;
  }
  if (skip !== "era" && f.era && p.era !== f.era) return false;
  if (skip !== "gender" && f.gender && p.gender !== f.gender) return false;
  if (skip !== "board" && f.board && !p.examBoards.includes(f.board)) return false;
  return true;
}

export function facetCounts<K extends string>(
  pieces: Piece[],
  f: Filters,
  facet: Facet,
  keyOf: (p: Piece) => K | K[] | null,
): Map<K, number> {
  const m = new Map<K, number>();
  for (const p of pieces) {
    if (!matches(p, f, facet)) continue;
    const k = keyOf(p);
    if (k == null) continue;
    for (const kk of Array.isArray(k) ? k : [k]) m.set(kk, (m.get(kk) ?? 0) + 1);
  }
  return m;
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });
export const compareTitle = (a: string, b: string) => collator.compare(a, b);

export function sortPieces(list: { piece: Piece; score: number }[], sort: Filters["sort"]) {
  const byComposerTitle = (a: Piece, b: Piece) =>
    collator.compare(a.composer, b.composer) || collator.compare(a.title, b.title);
  return list.sort((x, y) => {
    const a = x.piece;
    const b = y.piece;
    switch (sort) {
      case "relevance":
        return y.score - x.score || a.level - b.level || byComposerTitle(a, b);
      case "composer":
        return byComposerTitle(a, b);
      case "length":
        return (a.minutes ?? 999) - (b.minutes ?? 999) || a.level - b.level || byComposerTitle(a, b);
      default:
        return a.level - b.level || byComposerTitle(a, b);
    }
  });
}

export type ResultRow =
  | { kind: "piece"; piece: Piece }
  | { kind: "set"; key: string; name: string; composer: string; pieces: Piece[]; total: number };

/** Groups set members that appear together in the results; a lone member stays a normal row. */
export function groupResults(sorted: Piece[], setTotals: Map<string, number>): ResultRow[] {
  const bySet = new Map<string, Piece[]>();
  for (const p of sorted) if (p.setKey) bySet.set(p.setKey, [...(bySet.get(p.setKey) ?? []), p]);
  const rows: ResultRow[] = [];
  const emitted = new Set<string>();
  for (const p of sorted) {
    const members = p.setKey ? bySet.get(p.setKey)! : null;
    if (!members || members.length < 2) {
      rows.push({ kind: "piece", piece: p });
      continue;
    }
    if (emitted.has(p.setKey!)) continue;
    emitted.add(p.setKey!);
    const ordered = [...members].sort((a, b) => collator.compare(a.title, b.title));
    rows.push({
      kind: "set",
      key: p.setKey!,
      name: p.set!,
      composer: p.composerName,
      pieces: ordered,
      total: setTotals.get(p.setKey!) ?? members.length,
    });
  }
  return rows;
}

/** Ladder for a piece page: same setting & type, one level below / above, similar vibe first. */
export function ladder(all: Piece[], piece: Piece, dir: -1 | 1, limit = 4): Piece[] {
  const target = piece.level + dir;
  return all
    .filter(
      (p) =>
        p.id !== piece.id &&
        p.level === target &&
        p.type === piece.type &&
        p.settings.some((s) => piece.settings.includes(s)) &&
        (p.setKey == null || p.setKey !== piece.setKey),
    )
    .map((p) => ({
      p,
      s:
        p.character.filter((c) => piece.character.includes(c)).length +
        (p.mode && p.mode === piece.mode ? 1 : 0) +
        (p.era === piece.era ? 1 : 0) +
        (p.popularity === "well-known" ? 0.5 : 0),
    }))
    .sort((a, b) => b.s - a.s || collator.compare(a.p.composer, b.p.composer))
    .slice(0, limit)
    .map((x) => x.p);
}
