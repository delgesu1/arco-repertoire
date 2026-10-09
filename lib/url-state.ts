import { EMPTY_FILTERS, type Filters } from "./filter";
import { ERAS, SETTINGS, TYPES } from "./vocab";

const num = (v: string | null) => (v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null);
const oneOf = <T extends string>(v: string | null, allowed: readonly T[]): T | null =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : null;

export function filtersFromParams(sp: URLSearchParams): Filters {
  const level = num(sp.get("lv"));
  return {
    q: sp.get("q") ?? "",
    type: oneOf(sp.get("type"), TYPES.map((t) => t.key)),
    setting: oneOf(sp.get("set"), SETTINGS.map((s) => s.key)),
    level: level != null && level >= 1 && level <= 10 ? Math.round(level) : null,
    exact: sp.get("exact") === "1",
    mode: oneOf(sp.get("mode"), ["major", "minor"] as const),
    pace: oneOf(sp.get("pace"), ["slow", "moderate", "lively"] as const),
    character: (sp.get("ch") ?? "").split(",").filter(Boolean),
    popularity: oneOf(sp.get("pop"), ["well-known", "lesser-known"] as const),
    minMin: num(sp.get("min")),
    maxMin: num(sp.get("max")),
    era: oneOf(sp.get("era"), ERAS.map((e) => e.key)),
    gender: oneOf(sp.get("g"), ["F", "M"] as const),
    board: sp.get("board") || null,
    sort: oneOf(sp.get("sort"), ["level", "composer", "length", "relevance"] as const) ?? EMPTY_FILTERS.sort,
  };
}

/** Writes filters into a copy of `base`, preserving unrelated params (e.g. ?piece=). */
export function paramsFromFilters(f: Filters, base: URLSearchParams): URLSearchParams {
  const p = new URLSearchParams(base);
  const set = (k: string, v: string | number | null | undefined | false) => {
    if (v === null || v === undefined || v === "" || v === false) p.delete(k);
    else p.set(k, String(v));
  };
  set("q", f.q.trim() || null);
  set("type", f.type);
  set("set", f.setting);
  set("lv", f.level);
  set("exact", f.level != null && f.exact ? 1 : null);
  set("mode", f.mode);
  set("pace", f.pace);
  set("ch", f.character.join(",") || null);
  set("pop", f.popularity);
  set("min", f.minMin);
  set("max", f.maxMin);
  set("era", f.era);
  set("g", f.gender);
  set("board", f.board);
  set("sort", f.sort === EMPTY_FILTERS.sort ? null : f.sort);
  return p;
}

export function writeUrl(p: URLSearchParams, push = false) {
  const qs = p.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  if (push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}
