import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { chamberPieces, getChamberPiece } from "../chamber/catalogue";
import { fitGroup, groupLabel, partTakers, withPlayers, type Group } from "../chamber/ensemble";
import { MAX_CHAMBER_PLAYERS } from "../chamber/scope";
import { EMPTY_CHAMBER_FILTERS, matchesChamber, type ChamberFilters } from "../chamber/filter";
import { indexChamber, searchChamber } from "../chamber/search";
import type { ChamberPiece, InstrumentKey } from "../chamber/types";
import { FORMATIONS, FORMS, INSTRUMENTS, ensembleLabel, formSingular, formationLabel, instrumentList } from "../chamber/vocab";
import type { IndexedPiece } from "../search";
import { CHARACTER, ERAS, eraLabel } from "../vocab";
import { CHAMBER_BY_RENOWN } from "./chamber-catalogue-text";
import { askUserTool, runAskUser, runShowResults, showResultsTool, type ToolOutcome } from "./shared";
import { detailLines } from "./tools";

const formationKeys = FORMATIONS.map((f) => f.key);
const formKeys = FORMS.map((f) => f.key);
const eraKeys = ERAS.map((e) => e.key);
// electronics are not a player
const playerKeys = (Object.keys(INSTRUMENTS) as InstrumentKey[]).filter((k) => INSTRUMENTS[k].family !== "electronics");
const instrumentKeys = Object.keys(INSTRUMENTS) as InstrumentKey[];

// the filters every search can take (match_ensemble takes them too, except the scoring ones it works out itself)
const workFilterProps = {
  form: { type: "string", enum: formKeys, description: "work = a complete work; short = a single shorter piece; set = a collection of pieces" },
  level_min: { type: "integer", minimum: 1, maximum: 10 },
  level_max: { type: "integer", minimum: 1, maximum: 10 },
  hardest_part: {
    type: "string",
    enum: ["balanced", ...playerKeys],
    description: "the part that sets the level (e.g. piano: the piano part is the hardest; balanced: no part clearly harder)",
  },
  mode: { type: "string", enum: ["major", "minor"] },
  pace: { type: "string", enum: ["slow", "moderate", "lively"] },
  character: { type: "array", items: { type: "string", enum: [...CHARACTER] } },
  popularity: { type: "string", enum: ["well-known", "lesser-known"] },
  min_minutes: { type: "number" },
  max_minutes: { type: "number" },
  era: { type: "string", enum: eraKeys },
  women_composers: { type: "boolean" },
  query: { type: "string", description: "free-text search: composer, title, nickname, catalogue no., key, or words like 'tango' or 'Christmas'" },
} as const;

const scoringProps = {
  formation: { type: "string", enum: formationKeys },
  instruments: {
    type: "array",
    items: { type: "string", enum: instrumentKeys },
    description: "instruments that must each have a part (published alternatives and ad lib. parts count)",
  },
  players_min: { type: "integer", minimum: 2, maximum: MAX_CHAMBER_PLAYERS },
  players_max: { type: "integer", minimum: 2, maximum: MAX_CHAMBER_PLAYERS },
} as const;

export const CHAMBER_TOOLS: Anthropic.Tool[] = [
  {
    name: "match_ensemble",
    description:
      "What a particular group of players can play. Give every player in the group; returns the works the group plays as it is " +
      "(one player to a part, nobody left out, using published alternative instruments, ad lib. parts and the usual continuo " +
      "and keyboard substitutions), best known first. With add: 1 or 2 it also lists which instruments to add and what each " +
      "addition opens up; with sit_out it lists what the group plays if one player sits out. Optional filters narrow the works.",
    input_schema: {
      type: "object",
      properties: {
        players: {
          type: "array",
          minItems: 1,
          maxItems: MAX_CHAMBER_PLAYERS,
          items: {
            type: "object",
            properties: { instrument: { type: "string", enum: playerKeys }, count: { type: "integer", minimum: 1, maximum: MAX_CHAMBER_PLAYERS } },
            required: ["instrument", "count"],
            additionalProperties: false,
          },
        },
        add: { type: "integer", minimum: 0, maximum: 2, description: "also show what adding 1 (or 2) players would open up" },
        sit_out: { type: "boolean", description: "also show what the group plays if one player sits out" },
        ...workFilterProps,
        limit: { type: "integer", minimum: 1, maximum: 40, description: "how many of the works that fit to list (default 15)" },
      },
      required: ["players"],
      additionalProperties: false,
    },
  },
  {
    name: "search_catalogue",
    description:
      "Filter the whole chamber catalogue exactly, including works that are not listed in your system prompt. Returns the " +
      "total, the spread of levels and ensembles, and the matching works (best known first unless you sort). All filters are " +
      "optional and combine with AND.",
    input_schema: {
      type: "object",
      properties: {
        ...scoringProps,
        ...workFilterProps,
        sort: { type: "string", enum: ["renown", "easiest", "hardest"], description: "default renown (best known first)" },
        limit: { type: "integer", minimum: 1, maximum: 40 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_pieces",
    description:
      "Full details for up to 10 works: scoring with alternatives and ad lib. parts, hardest part, year, other names, set, notes, whether a recording is available.",
    input_schema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "integer" }, minItems: 1, maxItems: 10 } },
      required: ["ids"],
      additionalProperties: false,
    },
  },
  showResultsTool("For your piano trio, levels 4–5"),
  {
    name: "set_filters",
    description: "Set the chamber list's browse filters for the user (replaces current filters). Use for browsing requests.",
    input_schema: {
      type: "object",
      properties: {
        formation: scoringProps.formation,
        instruments: scoringProps.instruments,
        form: workFilterProps.form,
        level: { type: "integer", minimum: 1, maximum: 10 },
        exact_level: { type: "boolean" },
        mode: workFilterProps.mode,
        pace: workFilterProps.pace,
        character: workFilterProps.character,
        popularity: workFilterProps.popularity,
        min_minutes: workFilterProps.min_minutes,
        max_minutes: workFilterProps.max_minutes,
        era: workFilterProps.era,
        women_composers: workFilterProps.women_composers,
        query: workFilterProps.query,
      },
      additionalProperties: false,
    },
  },
  askUserTool,
].map((t) => ({ ...t, eager_input_streaming: true })) as Anthropic.Tool[];

// ── input validation ─────────────────────────────────────────────────
const anyOf = <T extends string>(keys: readonly T[]) => z.enum(keys as unknown as [T, ...T[]]);
const workFilters = {
  form: anyOf(formKeys).optional(),
  level_min: z.number().int().min(1).max(10).optional(),
  level_max: z.number().int().min(1).max(10).optional(),
  hardest_part: anyOf(["balanced", ...playerKeys]).optional(),
  mode: z.enum(["major", "minor"]).optional(),
  pace: z.enum(["slow", "moderate", "lively"]).optional(),
  character: z.array(z.enum(CHARACTER)).optional(),
  popularity: z.enum(["well-known", "lesser-known"]).optional(),
  min_minutes: z.number().optional(),
  max_minutes: z.number().optional(),
  era: anyOf(eraKeys).optional(),
  women_composers: z.boolean().optional(),
  query: z.string().max(200).optional(),
  limit: z.number().int().min(1).max(40).optional(),
};
const scoringFilters = {
  formation: anyOf(formationKeys).optional(),
  instruments: z.array(anyOf(instrumentKeys)).max(9).optional(),
  players_min: z.number().int().min(2).max(MAX_CHAMBER_PLAYERS).optional(),
  players_max: z.number().int().min(2).max(MAX_CHAMBER_PLAYERS).optional(),
};
const SearchInput = z.object({ ...scoringFilters, ...workFilters, sort: z.enum(["renown", "easiest", "hardest"]).optional() }).strict();
const MatchInput = z
  .object({
    players: z.array(z.object({ instrument: anyOf(playerKeys), count: z.number().int().min(1).max(MAX_CHAMBER_PLAYERS) }).strict()).min(1).max(MAX_CHAMBER_PLAYERS),
    add: z.number().int().min(0).max(2).optional(),
    sit_out: z.boolean().optional(),
    ...workFilters,
  })
  .strict();
const IdsInput = z.object({ ids: z.array(z.number().int()).min(1).max(10) }).strict();
const SetInput = z
  .object({
    formation: scoringFilters.formation,
    instruments: scoringFilters.instruments,
    form: workFilters.form,
    level: z.number().int().min(1).max(10).optional(),
    exact_level: z.boolean().optional(),
    mode: workFilters.mode,
    pace: workFilters.pace,
    character: workFilters.character,
    popularity: workFilters.popularity,
    min_minutes: workFilters.min_minutes,
    max_minutes: workFilters.max_minutes,
    era: workFilters.era,
    women_composers: workFilters.women_composers,
    query: workFilters.query,
  })
  .strict();

type WorkFilterInput = z.infer<z.ZodObject<typeof workFilters>> & Partial<z.infer<z.ZodObject<typeof scoringFilters>>>;

// ── helpers ──────────────────────────────────────────────────────────
const renownRank = new Map(CHAMBER_BY_RENOWN.map((id, i) => [id, i]));
const byRenown = (a: ChamberPiece, b: ChamberPiece) => (renownRank.get(a.id) ?? 1e9) - (renownRank.get(b.id) ?? 1e9);
let index: IndexedPiece<ChamberPiece>[] | null = null;

const compact = (p: ChamberPiece, extra = "") =>
  [
    p.id,
    p.composerName,
    p.arranger ? `${p.title} (arr. ${p.arranger})` : p.title,
    `L${p.level}`,
    instrumentList(p.chamber.instruments, p.chamber),
    `hardest: ${p.chamber.hardestPart}`,
    p.minutes ? `${p.minutes} min` : "",
    [p.chamber.form === "work" ? "" : formSingular(p.chamber.form).toLowerCase(), p.mode, p.pace, ...p.character].filter(Boolean).join(","),
    p.popularity ?? "",
  ].join("|") + extra;

const hardestMatches = (p: ChamberPiece, h: string) =>
  h === "balanced" ? p.chamber.hardestPart === "balanced" : p.chamber.hardestPart.replace(/ \d+$/, "").replace(/ /g, "-") === h;

/** the works passing every filter given, best known first */
function filtered(i: WorkFilterInput): ChamberPiece[] {
  const f: ChamberFilters = {
    ...EMPTY_CHAMBER_FILTERS,
    form: i.form ?? null,
    formation: i.formation ?? null,
    instruments: i.instruments ?? [],
    mode: i.mode ?? null,
    pace: i.pace ?? null,
    character: i.character ?? [],
    popularity: i.popularity ?? null,
    minMin: i.min_minutes ?? null,
    maxMin: i.max_minutes ?? null,
    era: i.era ?? null,
    gender: i.women_composers ? "F" : null,
  };
  const lo = i.level_min ?? 1;
  const hi = i.level_max ?? 10;
  let list = chamberPieces.filter(
    (p) =>
      p.level >= lo &&
      p.level <= hi &&
      (i.players_min == null || p.chamber.players >= i.players_min) &&
      (i.players_max == null || p.chamber.players <= i.players_max) &&
      (!i.hardest_part || hardestMatches(p, i.hardest_part)) &&
      matchesChamber(p, f),
  );
  if (i.query) {
    index ??= indexChamber(chamberPieces);
    const hits = new Set(searchChamber(index, i.query).map((r) => r.piece.id));
    list = list.filter((p) => hits.has(p.id));
  }
  return list.sort(byRenown);
}

/** "levels 3:4 4:12 5:20 · string quartets 30, piano trios 6" */
function spread(list: ChamberPiece[]): string {
  const lv = new Map<number, number>();
  const ens = new Map<string, number>();
  for (const p of list) {
    lv.set(p.level, (lv.get(p.level) ?? 0) + 1);
    ens.set(p.chamber.formation, (ens.get(p.chamber.formation) ?? 0) + 1);
  }
  const levels = [...lv].sort((a, b) => a[0] - b[0]).map(([l, n]) => `${l}:${n}`).join(" ");
  const ensembles = [...ens]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, n]) => `${formationLabel(k as ChamberPiece["chamber"]["formation"]).toLowerCase()} ${n}`)
    .join(", ");
  return list.length ? `levels ${levels} · ${ensembles}` : "";
}

function filterLabel(i: WorkFilterInput): string {
  return [
    ...(i.character ?? []),
    i.pace,
    i.mode,
    i.popularity,
    i.era && eraLabel(i.era).toLowerCase(),
    i.form && FORMS.find((x) => x.key === i.form)?.label.toLowerCase(),
    i.formation && formationLabel(i.formation).toLowerCase(),
    ...(i.instruments ?? []).map((k) => `with ${INSTRUMENTS[k].label}`),
    i.women_composers && "by women",
    i.level_min || i.level_max
      ? i.level_min === i.level_max
        ? `level ${i.level_min}`
        : `levels ${i.level_min ?? 1}–${i.level_max ?? 10}`
      : "",
    i.query && `“${i.query}”`,
  ]
    .filter(Boolean)
    .join(" · ");
}

function matchEnsemble(i: z.infer<typeof MatchInput>): ToolOutcome {
  const group: Group = {};
  for (const p of i.players) group[p.instrument] = (group[p.instrument] ?? 0) + p.count;
  const size = Object.values(group).reduce((n, c) => n + (c ?? 0), 0);
  const works = filtered(i);
  const limit = i.limit ?? 15;
  const filters = filterLabel(i);
  const out: string[] = [`Group: ${groupLabel(group)} (${size} players)${filters ? `; filters: ${filters}` : ""}`];

  type Hit = { p: ChamberPiece; notes: string[]; substitute: boolean };
  const fits: Hit[] = [];
  const rest: ChamberPiece[] = [];
  for (const p of works) {
    const fit = fitGroup(p.chamber, group);
    if (fit) fits.push({ p, ...fit });
    else rest.push(p);
  }
  const noted = (x: Hit) => compact(x.p, x.notes.length ? ` [${x.notes.join("; ")}]` : "");
  // fits that need a substitute the score doesn't name (trio sonatas with the piano on the continuo …) come after the rest
  const plain = fits.filter((x) => !x.substitute);
  const subbed = fits.filter((x) => x.substitute);
  out.push(
    `\nPlays as it is: ${plain.length} works${plain.length ? ` (${spread(plain.map((x) => x.p))})` : ""}` +
      (plain.length > limit ? `. The ${limit} best known:` : plain.length ? ":" : "."),
    ...plain.slice(0, limit).map(noted),
  );
  if (subbed.length)
    out.push(
      `\nAlso playable with a substitute the score doesn't name: ${subbed.length} works (${spread(subbed.map((x) => x.p))}). Best known:`,
      ...subbed.slice(0, 4).map(noted),
    );

  const options = (label: string, groups: Map<string, Hit[]>, examples: number) => {
    const ranked = [...groups]
      .map(([key, list]) => ({ key, plain: list.filter((x) => !x.substitute), subbed: list.filter((x) => x.substitute) }))
      .sort((a, b) => b.plain.length - a.plain.length || b.subbed.length - a.subbed.length)
      .slice(0, 8);
    if (!ranked.length) return out.push(`\n${label}: nothing more within these filters.`);
    out.push(`\n${label}:`);
    for (const r of ranked) {
      const all = [...r.plain, ...r.subbed];
      out.push(
        `${r.key} → ${r.plain.length} works${r.subbed.length ? ` (+${r.subbed.length} more with a substitute)` : ""} (${spread(all.map((x) => x.p))}). Best known:`,
        ...all.slice(0, examples).map((x) => "  " + noted(x)),
      );
    }
  };

  if (i.add) {
    const groups = new Map<string, Hit[]>();
    for (const p of rest) {
      const takers = [...partTakers(p.chamber)].filter((k) => INSTRUMENTS[k].family !== "electronics" && k !== "continuo");
      const tries: InstrumentKey[][] = takers.map((k) => [k]);
      if (i.add === 2) for (let a = 0; a < takers.length; a++) for (let b = a; b < takers.length; b++) tries.push([takers[a], takers[b]]);
      // the fewest players first: a work two more players open is listed only if one more does not already
      let opened = false;
      for (const extra of tries) {
        if (extra.length === 2 && opened) break;
        const fit = fitGroup(p.chamber, withPlayers(group, extra));
        if (!fit) continue;
        opened = true;
        const key = "+ " + groupLabel(withPlayers({}, extra));
        groups.set(key, [...(groups.get(key) ?? []), { p, ...fit }]);
      }
    }
    options(i.add === 1 ? "Adding one player" : "Adding one or two players", groups, 3);
  }

  if (i.sit_out) {
    const groups = new Map<string, Hit[]>();
    for (const k of Object.keys(group) as InstrumentKey[]) {
      const smaller: Group = { ...group, [k]: (group[k] ?? 0) - 1 };
      for (const p of works) {
        const fit = fitGroup(p.chamber, smaller);
        if (fit) {
          const key = `without one ${INSTRUMENTS[k].label}`;
          groups.set(key, [...(groups.get(key) ?? []), { p, ...fit }]);
        }
      }
    }
    options("If one player sits out", groups, 3);
  }

  return { result: out.join("\n"), status: `Matching works to ${groupLabel(group)}…` };
}

export async function runChamberTool(name: string, input: unknown): Promise<ToolOutcome> {
  switch (name) {
    case "match_ensemble": {
      const i = MatchInput.safeParse(input);
      if (!i.success) return { result: `Invalid input: ${i.error.message}`, isError: true };
      return matchEnsemble(i.data);
    }
    case "search_catalogue": {
      const i = SearchInput.safeParse(input);
      if (!i.success) return { result: `Invalid input: ${i.error.message}`, isError: true };
      let list = filtered(i.data);
      if (i.data.sort === "easiest") list = [...list].sort((a, b) => a.level - b.level || byRenown(a, b));
      if (i.data.sort === "hardest") list = [...list].sort((a, b) => b.level - a.level || byRenown(a, b));
      const limit = i.data.limit ?? 25;
      const label = filterLabel(i.data);
      return {
        result:
          `${list.length} matches${list.length ? ` (${spread(list)})` : ""}${list.length > limit ? `; showing ${limit}` : ""}:\n` +
          list.slice(0, limit).map((p) => compact(p)).join("\n"),
        status: `Searching ${label || "the catalogue"}…`,
      };
    }
    case "get_pieces": {
      const i = IdsInput.safeParse(input);
      if (!i.success) return { result: `Invalid input: ${i.error.message}`, isError: true };
      const out = i.data.ids.map((id) => {
        const p = getChamberPiece(id);
        if (!p) return `${id}: not in the chamber catalogue`;
        const c = p.chamber;
        return [
          compact(p),
          `ensemble: ${ensembleLabel(c)}; ${c.players} players; ${formSingular(c.form).toLowerCase()}`,
          c.year && `composed: ${c.year}`,
          c.aka?.length && `also known as: ${c.aka.join("; ")}`,
          p.set && `set: ${p.set}`,
          p.notes && `notes: ${p.notes}`,
          `era: ${eraLabel(p.era)}; dates: ${p.dates}; nationality: ${p.nationality}`,
          ...detailLines(p.id),
          `recording on site: ${p.recording ? "yes" : "no"}`,
          p.sections.includes("violin") && "also listed in the violin section",
        ]
          .filter(Boolean)
          .join("\n  ");
      });
      return { result: out.join("\n"), status: "Reading the details…" };
    }
    case "show_results":
      return runShowResults(input, getChamberPiece);
    case "set_filters": {
      const i = SetInput.safeParse(input);
      if (!i.success) return { result: `Invalid input: ${i.error.message}`, isError: true };
      const d = i.data;
      const params: Record<string, string> = {};
      if (d.query) params.q = d.query;
      if (d.form) params.form = d.form;
      if (d.formation) params.ens = d.formation;
      if (d.instruments?.length) params.with = d.instruments.join(",");
      if (d.level) params.lv = String(d.level);
      if (d.level && d.exact_level) params.exact = "1";
      if (d.mode) params.mode = d.mode;
      if (d.pace) params.pace = d.pace;
      if (d.character?.length) params.ch = d.character.join(",");
      if (d.popularity) params.pop = d.popularity;
      if (d.min_minutes != null) params.min = String(d.min_minutes);
      if (d.max_minutes != null) params.max = String(d.max_minutes);
      if (d.era) params.era = d.era;
      if (d.women_composers) params.g = "F";
      return { result: "Filters applied; the user now sees that list.", ui: { kind: "filters", params } };
    }
    case "ask_user":
      return runAskUser(input);
    default:
      return { result: `Unknown tool ${name}`, isError: true };
  }
}
