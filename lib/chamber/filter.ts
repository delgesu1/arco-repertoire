import { EMPTY_FILTERS, compareTitle, matchesCommon, type CommonFacet, type Filters } from "../filter";
import type { ChamberPiece, FormKey, FormationKey, InstrumentKey } from "./types";
import { playableBy } from "./vocab";

/**
 * The chamber list's filters: the violin list's shared ones (level, key, pace, character, length, era …) plus the form, the
 * formation and the instruments a work must include. The violin-only fields (type, setting, exam board) stay null here, so
 * the shared toolbar works on both lists.
 */
export interface ChamberFilters extends Filters {
  form: FormKey | null;
  formation: FormationKey | null;
  instruments: InstrumentKey[]; // every one of them must have a part (alternatives and ad lib. parts count)
}

export const EMPTY_CHAMBER_FILTERS: ChamberFilters = { ...EMPTY_FILTERS, form: null, formation: null, instruments: [] };

export type ChamberFacet = CommonFacet | "form" | "formation" | "instruments";

/** All filters except `skip`, as lib/filter.ts matches() does for the violin list. */
export function matchesChamber(p: ChamberPiece, f: ChamberFilters, skip?: ChamberFacet): boolean {
  if (skip !== "form" && f.form && p.chamber.form !== f.form) return false;
  if (skip !== "formation" && f.formation && p.chamber.formation !== f.formation) return false;
  if (skip !== "instruments" && f.instruments.length) {
    const can = playableBy(p.chamber);
    if (!f.instruments.every((k) => can.has(k))) return false;
  }
  return matchesCommon(p, f, skip);
}

export function chamberFacetCounts<K extends string>(
  pieces: ChamberPiece[],
  f: ChamberFilters,
  facet: ChamberFacet,
  keyOf: (p: ChamberPiece) => K | K[] | Iterable<K> | null,
): Map<K, number> {
  const m = new Map<K, number>();
  for (const p of pieces) {
    if (!matchesChamber(p, f, facet)) continue;
    const k = keyOf(p);
    if (k == null) continue;
    for (const kk of typeof k === "string" ? [k] : k) m.set(kk, (m.get(kk) ?? 0) + 1);
  }
  return m;
}

/**
 * Counts for the "includes" chips: how many works would match if this instrument were added to the ones already chosen
 * (a chosen instrument shows the current total).
 */
export function instrumentCounts(pieces: ChamberPiece[], f: ChamberFilters): Map<InstrumentKey, number> {
  const m = new Map<InstrumentKey, number>();
  for (const p of pieces) {
    if (!matchesChamber(p, f)) continue;
    for (const k of playableBy(p.chamber)) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** "A step before / after" on a chamber piece page: the same formation one level down or up, similar character first. */
export function chamberLadder(all: ChamberPiece[], piece: ChamberPiece, dir: -1 | 1, limit = 4): ChamberPiece[] {
  const target = piece.level + dir;
  return all
    .filter(
      (p) =>
        p.id !== piece.id &&
        p.level === target &&
        p.chamber.formation === piece.chamber.formation &&
        (p.setKey == null || p.setKey !== piece.setKey),
    )
    .map((p) => ({
      p,
      s:
        p.character.filter((c) => piece.character.includes(c)).length +
        (p.mode && p.mode === piece.mode ? 1 : 0) +
        (p.era === piece.era ? 1 : 0) +
        (p.chamber.form === piece.chamber.form ? 1 : 0) +
        (p.popularity === "well-known" ? 0.5 : 0),
    }))
    .sort((a, b) => b.s - a.s || compareTitle(a.p.composer, b.p.composer))
    .slice(0, limit)
    .map((x) => x.p);
}
