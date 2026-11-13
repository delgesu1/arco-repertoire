import { describe, expect, it } from "vitest";
import { looseJson, safeLength, stripLeakedCalls } from "./leaked-call";
import { TOOLS, runTool } from "./tools";

const NAMES = TOOLS.map((t) => t.name);

// a real reply from the violin advisor (chat log, 2026-11-02 21:04 UTC): the picks written out as code instead of a tool call
const LEAKED = `A few Slavic pieces that deserve more recital time than they get. For a warm, singing finish, the Pejačević is my first pick. For a bright closer, use the Młynarski.

show_results({
  title: "Lesser-known Slavic encore pieces",
  items: [
    {id: 1124, title_hint: "Méditation, Op. 51", reason: "Slow, inward and expressive; a late Croatian work that makes a good recital centrepiece."},
    {id: 1094, title_hint: "Mazurka No. 2, Op. 7", reason: "Polish folk-dance rhythm with real swing; a bright closer that suits an encore."},
    {id: 911, title_hint: "Ballade in D minor, Op. 15", reason: "Dark, singing minor-key drama from Dvořák's Czech output, with a full arc in a short span."},
    {id: 1286, title_hint: "Romance in D major, Op. 23", reason: "Tender, long-breathed lyricism by Szymanowski, dedicated to Paul Kochański; asks for beautiful tone."},
    {id: 1348, title_hint: "Adagio élégiaque in A major, Op. 5", reason: "A slow, tender Wieniawski piece that rewards phrasing and a singing sound."},
    {id: 2048, title_hint: "Legend and Burlesque, Op. 3", reason: "A lyrical Legend paired with a witty Burlesque by the Czech composer Kaprálová; contrast in two movements."}
  ]
})`;
const PROSE = LEAKED.slice(0, LEAKED.indexOf("\n\nshow_results"));

describe("a tool call written as text", () => {
  it("is taken out of the reply, and its input is read", () => {
    const { text, calls } = stripLeakedCalls(LEAKED, NAMES);
    expect(text).toBe(PROSE);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("show_results");
    const input = calls[0].input as { title: string; items: { id: number }[] };
    expect(input.title).toBe("Lesser-known Slavic encore pieces");
    expect(input.items.map((i) => i.id)).toEqual([1124, 1094, 911, 1286, 1348, 2048]);
  });

  it("puts the picks in the list once it is run", async () => {
    const { calls } = stripLeakedCalls(LEAKED, NAMES);
    const out = await runTool(calls[0].name, calls[0].input);
    expect(out.isError).toBeFalsy();
    expect(out.ui?.kind).toBe("results");
  });

  it("never reaches the visitor while it streams", () => {
    let shown = "";
    for (let i = 7; i < LEAKED.length + 7; i += 7) {
      const sofar = LEAKED.slice(0, i);
      const safe = safeLength(sofar, NAMES);
      expect(safe).toBeGreaterThanOrEqual(shown.length);
      shown = sofar.slice(0, safe);
      expect(shown).not.toMatch(/show_|title_hint/);
    }
    const { text } = stripLeakedCalls(LEAKED, NAMES);
    expect(text.startsWith(shown.trimEnd())).toBe(true);
  });

  it("is found inside a code fence too", () => {
    const fenced = `Here you go.\n\n\`\`\`js\nshow_results({title: 'Two', items: [{id: 1, title_hint: 'x', reason: 'y',},],});\n\`\`\`\n\nEnjoy them.`;
    const { text, calls } = stripLeakedCalls(fenced, NAMES);
    expect(text).toBe("Here you go.\n\nEnjoy them.");
    expect(calls[0].input).toEqual({ title: "Two", items: [{ id: 1, title_hint: "x", reason: "y" }] });
  });

  it("leaves an ordinary reply alone", () => {
    const { text, calls } = stripLeakedCalls(PROSE, NAMES);
    expect(text).toBe(PROSE);
    expect(calls).toEqual([]);
    expect(safeLength(PROSE, NAMES)).toBe(PROSE.length);
  });

  it("reads a call it cannot parse as no input, and still takes it out", () => {
    const { text, calls } = stripLeakedCalls("Try these.\n\nshow_results({ title: Mixed up items: [ })", NAMES);
    expect(text).toBe("Try these.");
    expect(calls[0].input).toBeNull();
    expect(looseJson("{ a: 1, b: [2, 3,], c: 'it\\'s' }")).toEqual({ a: 1, b: [2, 3], c: "it's" });
  });
});
