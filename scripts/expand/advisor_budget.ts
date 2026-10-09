/** Measures how many tokens variants of the advisor catalogue cost (count_tokens is free). */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Catalogue, Piece } from "../../lib/types";

const ROOT = join(__dirname, "..", "..");
const cat: Catalogue = JSON.parse(readFileSync(join(ROOT, process.argv[2] ?? "data/expansion/preview/catalogue.json"), "utf8"));
const TYPE: Record<string, string> = { concerto: "co", sonata: "so", short: "sh", showpiece: "vs", concertpiece: "cp", suite: "su", solo: "sw", duet: "du", etude: "et", technique: "te" };
const SET: Record<string, string> = { solo: "un", piano: "pn", orchestra: "or", continuo: "bc", duo: "vv", other: "ot" };
const keyed = (t: string) => /\bin [A-G](?:-flat|-sharp)? (?:major|minor)\b/.test(t);

type Opts = { minutes: boolean; mode: boolean; type: boolean; setting: boolean; pop: boolean };
const line = (p: Piece, o: Opts) =>
  [
    p.id,
    p.title,
    p.level,
    o.type ? TYPE[p.type] : "",
    o.setting ? p.settings.map((s) => SET[s]).join("+") : "",
    o.minutes ? (p.minutes ?? "") : "",
    o.mode && !keyed(p.title) ? (p.mode === "major" ? "maj" : p.mode === "minor" ? "min" : "") : "",
    o.pop ? (p.popularity === "well-known" ? "W" : p.popularity === "lesser-known" ? "L" : "") : "",
  ]
    .join("|")
    .replace(/\|+$/, "");
function text(ps: Piece[], o: Opts) {
  const by = new Map<string, Piece[]>();
  for (const p of [...ps].sort((a, b) => a.composer.localeCompare(b.composer) || a.level - b.level)) by.set(p.composer, [...(by.get(p.composer) ?? []), p]);
  return [...by.values()].map((l) => `# ${l[0].composer}${l[0].gender === "F" ? " (woman)" : ""}\n${l.map((p) => line(p, o)).join("\n")}`).join("\n");
}
async function count(t: string) {
  const r = await new Anthropic().messages.countTokens({ model: "claude-haiku-5-5", system: [{ type: "text", text: t }], messages: [{ role: "user", content: "Hello" }] });
  return r.input_tokens;
}
async function main() {
  const full: Opts = { minutes: true, mode: true, type: true, setting: true, pop: true };
  const old = cat.pieces.filter((p) => p.id <= 2253);
  const variants: [string, Piece[], Opts][] = [
    ["old catalogue, full format", old, full],
    ["all pieces, full format", cat.pieces, full],
    ["all pieces, no minutes", cat.pieces, { ...full, minutes: false }],
    ["all pieces, no minutes/mode", cat.pieces, { ...full, minutes: false, mode: false }],
    ["all pieces, titles+levels only", cat.pieces, { minutes: false, mode: false, type: false, setting: false, pop: false }],
  ];
  const base = await count("x");
  for (const [name, ps, o] of variants) {
    const t = text(ps, o);
    console.log(name.padEnd(36), String(ps.length).padStart(5), "pieces", String(t.length).padStart(7), "chars", String((await count(t)) - base).padStart(7), "tokens");
  }
}
main();
