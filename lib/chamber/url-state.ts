import { filtersFromParams, paramsFromFilters } from "../url-state";
import type { ChamberFilters } from "./filter";
import type { InstrumentKey } from "./types";
import { FORMATIONS, FORMS, INSTRUMENTS } from "./vocab";

const oneOf = <T extends string>(v: string | null, allowed: readonly T[]): T | null =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : null;

/**
 * /chamber?form=short&ens=string-quartet&lv=3&with=clarinet,viola — the shared parameters (q, lv, exact, mode, pace, ch, pop,
 * min, max, era, g, sort) read as on the violin list; the violin-only ones (type, set, board) are ignored.
 */
export function chamberFiltersFromParams(sp: URLSearchParams): ChamberFilters {
  const instruments = [...new Set((sp.get("with") ?? "").split(","))].filter((k): k is InstrumentKey =>
    Object.prototype.hasOwnProperty.call(INSTRUMENTS, k),
  );
  return {
    ...filtersFromParams(sp),
    type: null,
    setting: null,
    board: null,
    form: oneOf(sp.get("form"), FORMS.map((f) => f.key)),
    formation: oneOf(sp.get("ens"), FORMATIONS.map((f) => f.key)),
    instruments,
  };
}

/** Writes the filters into a copy of `base`, preserving unrelated params (e.g. ?piece=). */
export function paramsFromChamberFilters(f: ChamberFilters, base: URLSearchParams): URLSearchParams {
  const p = paramsFromFilters({ ...f, type: null, setting: null, board: null }, base);
  const set = (k: string, v: string | null) => (v ? p.set(k, v) : p.delete(k));
  set("form", f.form);
  set("ens", f.formation);
  set("with", f.instruments.join(",") || null);
  return p;
}
