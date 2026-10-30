import { describe, expect, it } from "vitest";
import data from "../../data/build/chamber.json";
import { EMPTY_CHAMBER_FILTERS, matchesChamber } from "./filter";
import { CHAMBER_OPTIONAL, queryTokens } from "../search";
import { indexChamber, searchChamber } from "./search";
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
