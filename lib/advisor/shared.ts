import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { fold } from "../search";

/** What both advisors (violin and chamber) send the page besides text. */
export type UiEvent =
  | { kind: "results"; title: string; items: { id: number; reason: string }[] }
  | { kind: "filters"; params: Record<string, string> }
  | { kind: "question"; question: string; options: string[] };

export type ToolOutcome = { result: string; isError?: boolean; ui?: UiEvent; endTurn?: boolean; status?: string };

/** One advisor: its cached system prompt, its tools and how to run them (app/api/advisor/route.ts picks one per section). */
export interface AdvisorKit {
  buildSystem: () => Anthropic.TextBlockParam[];
  tools: Anthropic.Tool[];
  runTool: (name: string, input: unknown) => Promise<ToolOutcome>;
}

export const showResultsTool = (example: string) => ({
  name: "show_results",
  description:
    "Show your recommended works in the site's main results list, each with a one-line reason. Use whenever you recommend specific works.",
  input_schema: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: `short heading, e.g. '${example}'` },
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
});

export const askUserTool = {
  name: "ask_user",
  description: "Ask the user one short question with 2–5 tappable answer options. Ends your turn.",
  input_schema: {
    type: "object" as const,
    properties: {
      question: { type: "string" },
      options: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 5 },
    },
    required: ["question", "options"],
    additionalProperties: false,
  },
};

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

type Titled = { title: string; composerName: string };
const words = (s: string) => new Set(fold(s).split(/[^a-z0-9]+/).filter((w) => w.length > 1));
function titleMatches(p: Titled, hint: string) {
  const a = words(`${p.title} ${p.composerName}`);
  const b = [...words(hint)];
  if (!b.length) return false;
  return b.filter((w) => a.has(w)).length / b.length >= 0.6;
}

/** show_results: refuses ids whose titles don't match the hint, so a wrong id never reaches the page */
export function runShowResults(input: unknown, getPiece: (id: number) => Titled | null): ToolOutcome {
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

export function runAskUser(input: unknown): ToolOutcome {
  const i = AskInput.safeParse(input);
  if (!i.success) return { result: `Invalid input: ${i.error.message}`, isError: true };
  return {
    result: "The question is shown to the user; their answer will arrive as the next message.",
    ui: { kind: "question", question: i.data.question, options: i.data.options },
    endTurn: true,
  };
}
