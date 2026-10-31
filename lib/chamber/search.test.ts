import { describe, expect, it } from "vitest";
import data from "../../data/build/chamber.json";
import { EMPTY_CHAMBER_FILTERS, matchesChamber } from "./filter";
import { CHAMBER_OPTIONAL, queryTokens } from "../search";
import { indexChamber, parseScoring, searchChamber } from "./search";
import type { ChamberCatalogue } from "./types";

const { pieces } = data as unknown as ChamberCatalogue;
const index = indexChamber(pieces);
const top = (q: string) => [...searchChamber(index, q)].sort((a, b) => b.score - a.score)[0]?.piece.title ?? "";

describe("chamber search", () => {
  it("finds works by nickname", () => {
    expect(top("death and the maiden")).toMatch(/D\. 810/);
    expect(top("trout")).toMatch(/D\. 667/);
    expect(top("archduke")).toMatch(/Op\. 97/);
    expect(top("dumky")).toMatch(/Op\. 90/);
  });
  it("finds works by their other names", () => {
    expect(top("Der Tod und das Mädchen")).toMatch(/D\. 810/);
    expect(top("forellenquintett")).toMatch(/D\. 667/);
    expect(top("kaiserquartett")).toMatch(/Op\. 76 No\. 3/);
    expect(top("quartet for the end of time")).toBe("Quatuor pour la fin du temps");
    expect(top("große fuge")).toMatch(/Op\. 133/);
  });
  it("finds catalogue numbers and instruments", () => {
    expect(top("schubert d 810")).toMatch(/D\. 810/);
    expect(searchChamber(index, "horn").map((r) => r.piece.title)).toContain("Horn Trio in E-flat major, Op. 40");
  });
  it("finds an arrangement by its credited arranger while retaining the composer", () => {
    const arrangement = { ...pieces[0], arranger: "Mihoko Kimura" };
    const hits = searchChamber(indexChamber([arrangement]), "kimura");
    expect(hits.map((r) => r.piece)).toEqual([arrangement]);
    expect(hits[0].piece.composer).toBe(pieces[0].composer);
    expect(searchChamber(indexChamber([pieces[0]]), "kimura")).toEqual([]);
  });
  it("treats violin as a real word", () => {
    // the violin list ignores it (every work there is for violin); here it is an instrument like any other
    expect(queryTokens("violin trio")).toEqual(["trio"]);
    expect(queryTokens("violin trio", CHAMBER_OPTIONAL)).toEqual(["violin", "trio"]);
    expect(queryTokens("trio for the violin", CHAMBER_OPTIONAL)).toEqual(["trio", "violin"]);
  });
});

describe("includes instrument", () => {
  const withAll = (...instruments: string[]) =>
    pieces.filter((p) => matchesChamber(p, { ...EMPTY_CHAMBER_FILTERS, instruments } as typeof EMPTY_CHAMBER_FILTERS)).map((p) => p.title);
  it("counts a published alternative", () => {
    expect(withAll("violin")).toContain('Trio in E-flat major, K. 498 ("Kegelstatt")');
    expect(withAll("cello")).toContain("Horn Trio in E-flat major, Op. 40");
  });
  it("counts an ad lib. part", () => {
    expect(withAll("double-bass")).toContain('Serenade No. 13 in G major, K. 525 ("Eine kleine Nachtmusik")');
  });
  it("needs every chosen instrument", () => {
    const both = withAll("clarinet", "piano");
    expect(both).toContain('Trio in E-flat major, K. 498 ("Kegelstatt")');
    expect(both).not.toContain("Clarinet Quintet in A major, K. 581");
  });
});

describe("same-instrument scorings in a search", () => {
  const scorings = (q: string) => new Set(searchChamber(index, q).map((r) => JSON.stringify(r.piece.chamber.instruments)));
  const best = (q: string) => [...searchChamber(index, q)].sort((a, b) => b.score - a.score)[0]?.piece.chamber.instruments;

  it("reads the ways people write them", () => {
    expect(parseScoring("4 cellos")).toMatchObject({ instrument: "cello", parts: 4, named: false, rest: "" });
    expect(parseScoring("for Eight Violins")).toMatchObject({ instrument: "violin", parts: 8, named: false });
    expect(parseScoring("4 double basses")).toMatchObject({ instrument: "double-bass", parts: 4 });
    expect(parseScoring("cello quartet")).toMatchObject({ instrument: "cello", parts: 4, named: true });
    expect(parseScoring("klengel 4 cellos")).toMatchObject({ parts: 4, rest: "klengel" });
    expect(parseScoring("2 violins")).toBeNull();
    expect(parseScoring("string quartet")).toBeNull();
    expect(parseScoring("clarinet quintet")).toBeNull();
  });

  it("a count lists only that scoring", () => {
    for (const q of ["4 cellos", "four cellos"]) expect(scorings(q)).toEqual(new Set([JSON.stringify({ cello: 4 })]));
    expect(scorings("8 violins")).toEqual(new Set([JSON.stringify({ violin: 8 })]));
    expect(scorings("klengel 4 cellos")).toEqual(new Set([JSON.stringify({ cello: 4 })]));
  });

  it("a name lists that scoring first and keeps the rest", () => {
    expect(best("cello quartet")).toEqual({ cello: 4 });
    expect(scorings("cello quintet").size).toBeGreaterThan(1);
    expect(searchChamber(index, "cello quintet").some((r) => /D\. 956/.test(r.piece.title))).toBe(true);
  });

  it("falls back to an ordinary search when nothing has that scoring", () => {
    expect(searchChamber(index, "3 cellos and piano").length).toBeGreaterThan(0);
  });
});
