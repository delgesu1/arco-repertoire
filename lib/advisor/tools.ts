import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getPiece, pieces } from "../catalogue";
import { EMPTY_FILTERS, matches, sortPieces, type Filters } from "../filter";
import { fold } from "../search";
import { CHARACTER, ERAS, SETTINGS, TYPES } from "../vocab";
import type { Piece } from "../types";

const typeKeys = TYPES.map((t) => t.key);
const settingKeys = SETTINGS.map((s) => s.key);
const eraKeys = ERAS.map((e) => e.key);

const filterProps = {
  type: { type: "string", enum: typeKeys },
  setting: { type: "string", enum: settingKeys },
  level_min: { type: "integer", minimum: 1, maximum: 10 },
  level_max: { type: "integer", minimum: 1, maximum: 10 },
  mode: { type: "string", enum: ["major", "minor"] },
  pace: { type: "string", enum: ["slow", "moderate", "lively"] },
  character: { type: "array", items: { type: "string", enum: [...CHARACTER] } },
  popularity: { type: "string", enum: ["well-known", "lesser-known"] },
  min_minutes: { type: "number" },
  max_minutes: { type: "number" },
  era: { type: "string", enum: eraKeys },
  women_composers: { type: "boolean" },
  query: { type: "string", description: "free-text search (composer, title, catalogue no., key)" },
} as const;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "search_catalogue",
    description:
      "Filter the whole catalogue exactly, including works that are not listed in your system prompt. Returns matching works (compact lines) and the total count. All filters are optional and combine with AND.",
    input_schema: {
      type: "object",
      properties: { ...filterProps, limit: { type: "integer", minimum: 1, maximum: 40 } },
      additionalProperties: false,
    },
  },
  {
    name: "get_pieces",
    description: "Full details for up to 10 works: notes, exam/syllabus listings, set, whether a recording is available.",
    input_schema: {
      type: "object",
      properties: { ids: { type: "array", items: { type: "integer" }, minItems: 1, maxItems: 10 } },
      required: ["ids"],
      additionalProperties: false,
    },
  },
  {
    name: "show_results",
    description:
      "Show your recommended works in the site's main results list, each with a one-line reason. Use whenever you recommend specific works.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "short heading, e.g. 'Next steps after the Accolay'" },
        items: {
          type: "array",
          minItems: 1,
          maxItems: 12,
          items: {
            type: "object",
            properties: {
              id: { type: "integer" },
              title_hint: { type: "string", description: "the work's title as written in the catalogue" },
              reason: { type: "string", description: "one short line: what it develops, its character, or why it fits (the row already shows level and length)" },
            },
            required: ["id", "title_hint", "reason"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "items"],
      additionalProperties: false,
    },
  },
  {
    name: "set_filters",
    description: "Set the site's browse filters for the user (replaces current filters). Use for browsing requests.",
    input_schema: {
      type: "object",
      properties: {
        type: filterProps.type,
        setting: filterProps.setting,
        level: { type: "integer", minimum: 1, maximum: 10 },
        exact_level: { type: "boolean" },
        mode: filterProps.mode,
        pace: filterProps.pace,
        character: filterProps.character,
        popularity: filterProps.popularity,
        min_minutes: filterProps.min_minutes,
        max_minutes: filterProps.max_minutes,
        era: filterProps.era,
        women_composers: filterProps.women_composers,
        query: filterProps.query,
      },
      additionalProperties: false,
    },
  },
  {
    name: "ask_user",
    description: "Ask the user one short question with 2–5 tappable answer options. Ends your turn.",
    input_schema: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
      },
      required: ["question", "options"],
      additionalProperties: false,
    },
  },
].map((t) => ({ ...t, eager_input_streaming: true })) as Anthropic.Tool[];

// ── input validation ─────────────────────────────────────────────────
const FilterInput = z
  .object({
    type: z.enum(typeKeys as [string, ...string[]]).optional(),
    setting: z.enum(settingKeys as [string, ...string[]]).optional(),
    level_min: z.number().int().min(1).max(10).optional(),
    level_max: z.number().int().min(1).max(10).optional(),
    level: z.number().int().min(1).max(10).optional(),
    exact_level: z.boolean().optional(),
    mode: z.enum(["major", "minor"]).optional(),
    pace: z.enum(["slow", "moderate", "lively"]).optional(),
    character: z.array(z.enum(CHARACTER)).optional(),
    popularity: z.enum(["well-known", "lesser-known"]).optional(),
    min_minutes: z.number().optional(),
    max_minutes: z.number().optional(),
    era: z.enum(eraKeys as [string, ...string[]]).optional(),
    women_composers: z.boolean().optional(),
    query: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(40).optional(),
  })
  .strict();
const IdsInput = z.object({ ids: z.array(z.number().int()).min(1).max(10) }).strict();
const ShowInput = z
  .object({
    title: z.string().max(200),
    items: z
      .array(z.object({ id: z.number().int(), title_hint: z.string(), reason: z.string().max(400) }).strict())
      .min(1)
      .max(12),
  })
  .strict();
const AskInput = z.object({ question: z.string().max(300), options: z.array(z.string().max(80)).min(2).max(5) }).strict();

// ── helpers ──────────────────────────────────────────────────────────
const compact = (p: Piece) =>
  `${p.id}|${p.composerName}|${p.title}|L${p.level}|${p.type}|${p.settings.join("+")}|${p.minutes ?? ""}|${[p.mode, p.pace, ...p.character].filter(Boolean).join(",")}|${p.popularity ?? ""}`;

function toFilters(i: z.infer<typeof FilterInput>): { f: Filters; lo: number; hi: number } {
  const f: Filters = {
    ...EMPTY_FILTERS,
    q: i.query ?? "",
    type: (i.type as Filters["type"]) ?? null,
    setting: (i.setting as Filters["setting"]) ?? null,
    mode: i.mode ?? null,
    pace: i.pace ?? null,
    character: i.character ?? [],
    popularity: i.popularity ?? null,
    minMin: i.min_minutes ?? null,
    maxMin: i.max_minutes ?? null,
    era: (i.era as Filters["era"]) ?? null,
    gender: i.women_composers ? "F" : null,
  };
  return { f, lo: i.level_min ?? i.level ?? 1, hi: i.level_max ?? i.level ?? 10 };
}

const words = (s: string) => new Set(fold(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1));
function titleMatches(p: Piece, hint: string) {
  const a = words(`${p.title} ${p.composerName}`);
  const b = [...words(hint)];
  if (!b.length) return false;
  return b.filter((w) => a.has(w)).length / b.length >= 0.6;
}

export type UiEvent =
  | { kind: "results"; title: string; items: { id: number; reason: string }[] }
  | { kind: "filters"; params: Record<string, string> }
  | { kind: "question"; question: string; options: string[] };

export type ToolOutcome = { result: string; isError?: boolean; ui?: UiEvent; endTurn?: boolean; status?: string };

export async function runTool(name: string, input: unknown): Promise<ToolOutcome> {
  switch (name) {
    case "search_catalogue": {
      const i = FilterInput.safeParse(input);
      if (!i.success) return { result: `Invalid input: ${i.error.message}`, isError: true };
      const { f, lo, hi } = toFilters(i.data);
      let list = pieces.filter((p) => p.level >= lo && p.level <= hi && matches(p, f));
      if (f.q) {
        const { indexPieces, search } = await import("../search");
        const hits = new Set(search(indexPieces(list), f.q).map((r) => r.piece.id));
        list = list.filter((p) => hits.has(p.id));
      }
      const sorted = sortPieces(list.map((piece) => ({ piece, score: 1 })), "level").map((r) => r.piece);
      const limit = i.data.limit ?? 25;
      const label = [
        ...(i.data.character ?? []),
        i.data.pace,
        i.data.mode,
        i.data.popularity,
        i.data.era,
        i.data.type && TYPES.find((x) => x.key === i.data.type)?.label.toLowerCase(),
        i.data.setting && SETTINGS.find((x) => x.key === i.data.setting)?.label.toLowerCase(),
        i.data.women_composers && "by women",
        lo === hi ? `level ${lo}` : lo > 1 || hi < 10 ? `levels ${lo}–${hi}` : "",
        i.data.query && `“${i.data.query}”`,
      ]
        .filter(Boolean)
        .join(" · ");
      return {
        result: `${sorted.length} matches${sorted.length > limit ? ` (showing ${limit})` : ""}:\n${sorted.slice(0, limit).map(compact).join("\n")}`,
        status: `Searching ${label || "the catalogue"}…`,
      };
    }
    case "get_pieces": {
      const i = IdsInput.safeParse(input);
      if (!i.success) return { result: `Invalid input: ${i.error.message}`, isError: true };
      const out = i.data.ids.map((id) => {
        const p = getPiece(id);
        if (!p) return `${id}: not in the catalogue`;
        return [
          compact(p),
          p.accompaniment && `accompaniment: ${p.accompaniment}`,
          p.set && `set: ${p.set}`,
          p.notes && `notes: ${p.notes}`,
          p.exams && `exams: ${p.exams}`,
          `era: ${p.era}; dates: ${p.dates}; nationality: ${p.nationality}`,
          `recording on site: ${p.recording ? "yes" : "no"}`,
        ]
          .filter(Boolean)
          .join("\n  ");
      });
      return { result: out.join("\n"), status: "Reading the details…" };
    }
    case "show_results": {
      const i = ShowInput.safeParse(input);
      if (!i.success) return { result: `Invalid input: ${i.error.message}`, isError: true };
      const bad = i.data.items.filter((it) => {
        const p = getPiece(it.id);
        return !p || !titleMatches(p, it.title_hint);
      });
      if (bad.length) {
        return {
          isError: true,
          result:
            "These ids don't match their titles — check the catalogue and call show_results again:\n" +
            bad.map((b) => `${b.id} ("${b.title_hint}") → ${getPiece(b.id) ? `id ${b.id} is "${getPiece(b.id)!.title}"` : "no such id"}`).join("\n"),
        };
      }
      return {
        result: "Shown to the user in the results list.",
        ui: { kind: "results", title: i.data.title, items: i.data.items.map((x) => ({ id: x.id, reason: x.reason })) },
      };
    }
    case "set_filters": {
      const i = FilterInput.safeParse(input);
      if (!i.success) return { result: `Invalid input: ${i.error.message}`, isError: true };
      const d = i.data;
      const params: Record<string, string> = {};
      if (d.query) params.q = d.query;
      if (d.type) params.type = d.type;
      if (d.setting) params.set = d.setting;
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
    case "ask_user": {
      const i = AskInput.safeParse(input);
      if (!i.success) return { result: `Invalid input: ${i.error.message}`, isError: true };
      return {
        result: "The question is shown to the user; their answer will arrive as the next message.",
        ui: { kind: "question", question: i.data.question, options: i.data.options },
        endTurn: true,
      };
    }
    default:
      return { result: `Unknown tool ${name}`, isError: true };
  }
}
