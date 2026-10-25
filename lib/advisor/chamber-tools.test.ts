import { describe, expect, it } from "vitest";
import { chamberPieces } from "../chamber/catalogue";
import { CHAMBER_BY_RENOWN, CHAMBER_CATALOGUE_TEXT } from "./chamber-catalogue-text";
import { hardestCode, scoringCode } from "./chamber-codes";
import { buildChamberSystem } from "./chamber-prompt";
import { runChamberTool } from "./chamber-tools";

describe("catalogue codes", () => {
  it("writes a scoring compactly, with alternatives and ad lib. parts", () => {
    expect(scoringCode({ instruments: { clarinet: 1, viola: 1, piano: 1 }, alternatives: { clarinet: ["violin"] } })).toBe("cl/vn va pf");
    expect(scoringCode({ instruments: { violin: 2, viola: 1, cello: 1 }, optional: { "double-bass": 1 } })).toBe("2vn va vc db?");
  });

  it("names the hardest part by code", () => {
    expect(hardestCode("violin 1")).toBe("vn1");
    expect(hardestCode("viola-da-gamba 1")).toBe("gb1");
    expect(hardestCode("double-bass")).toBe("db");
    expect(hardestCode("balanced")).toBe("bal");
  });
});

describe("the chamber advisor's catalogue", () => {
  it("ranks every work once", () => {
    expect(CHAMBER_BY_RENOWN.length).toBe(chamberPieces.length);
    expect(new Set(CHAMBER_BY_RENOWN).size).toBe(chamberPieces.length);
  });

  it("lists only real ids", () => {
    const ids = new Set(chamberPieces.map((p) => p.id));
    const listed = [...CHAMBER_CATALOGUE_TEXT.matchAll(/^(\d+)\|/gm)].map((m) => Number(m[1]));
    expect(listed.length).toBeGreaterThan(1000);
    expect(listed.filter((id) => !ids.has(id))).toEqual([]);
  });

  it("keeps the prompt below Haiku's 100K-token price step", () => {
    // about 0.64 tokens per character for the catalogue lines (see scripts/build-data.ts)
    expect(buildChamberSystem()[0].text.length).toBeLessThan(130_000);
  });
});

describe("chamber tools", () => {
  it("finds the Trout for its own players", async () => {
    const r = await runChamberTool("match_ensemble", {
      players: [
        { instrument: "violin", count: 1 },
        { instrument: "viola", count: 1 },
        { instrument: "cello", count: 1 },
        { instrument: "double-bass", count: 1 },
        { instrument: "piano", count: 1 },
      ],
    });
    expect(r.isError).toBeFalsy();
    expect(r.result).toMatch(/^100098\|Franz Schubert\|Piano Quintet in A major, D. 667/m);
  });

  it("says what adding a player opens up", async () => {
    const r = await runChamberTool("match_ensemble", {
      players: [
        { instrument: "violin", count: 1 },
        { instrument: "cello", count: 1 },
        { instrument: "piano", count: 1 },
      ],
      add: 1,
      level_max: 8,
    });
    expect(r.result).toMatch(/^\+ viola → \d+ works/m);
    expect(r.result).toContain("Piano Quartet");
  });

  it("filters searches exactly", async () => {
    const r = await runChamberTool("search_catalogue", { formation: "piano-quintet", level_max: 5, limit: 40 });
    const levels = [...r.result.matchAll(/\|L(\d+)\|/g)].map((m) => Number(m[1]));
    expect(levels.length).toBeGreaterThan(0);
    expect(levels.every((l) => l <= 5)).toBe(true);
    const rows = r.result.split("\n").slice(1);
    expect(rows.every((l) => l.split("|")[4].includes("piano"))).toBe(true);
  });

  it("refuses a suggestion whose id and title disagree", async () => {
    const r = await runChamberTool("show_results", {
      title: "Test",
      items: [{ id: 100098, title_hint: "Death and the Maiden", reason: "x" }],
    });
    expect(r.isError).toBe(true);
  });

  it("sets the chamber list's filters", async () => {
    const r = await runChamberTool("set_filters", { formation: "string-quartet", instruments: ["clarinet"], level: 4 });
    expect(r.ui).toEqual({ kind: "filters", params: { ens: "string-quartet", with: "clarinet", lv: "4" } });
  });
});
