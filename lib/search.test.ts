import { describe, expect, it } from "vitest";
import catalogue from "../data/build/catalogue.json";
import type { Catalogue } from "./types";
import { groupResults, sortPieces } from "./filter";
import { indexPieces, normalize, search } from "./search";

const { pieces } = catalogue as unknown as Catalogue;
const index = indexPieces(pieces);
const titles = (q: string) => search(index, q).map((r) => `${r.piece.composerName} — ${r.piece.title}`);

describe("normalize", () => {
  it("joins catalogue numbers, keys and grades", () => {
    expect(normalize("Concerto in E minor, Op. 64")).toBe(" concerto in eminor op64 ");
    expect(normalize("ABRSM Grade 7")).toBe(" abrsmgr7 ");
    expect(normalize("Sonata in B flat major")).toBe(" sonata in b-flatmajor ");
    expect(normalize("Dvořák")).toBe(" dvorak ");
  });
});

describe("search", () => {
  it("finds Vieuxtemps concertos", () => {
    const r = titles("vieuxtemps concerto");
    expect(r.length).toBeGreaterThanOrEqual(5);
    // other composers' notes may mention him ("Vieuxtemps-style bravura"), but his own works rank first
    expect(r.slice(0, 5).every((t) => t.includes("Vieuxtemps"))).toBe(true);
  });
  it("finds the Ysaÿe sonatas without the diaeresis", () => {
    expect(titles("ysaye sonata").some((t) => t.includes("Op. 27 No. 2"))).toBe(true);
  });
  it("matches catalogue numbers exactly", () => {
    const r = search(index, "tchaikovsky op 35");
    expect(r.map((x) => x.piece.title)).toContain("Concerto in D major, Op. 35");
    expect(r.every((x) => /Op\. 35\b/.test(x.piece.title))).toBe(true);
  });
  it("matches keys as one token", () => {
    const r = search(index, "e minor concerto");
    expect(r.length).toBeGreaterThan(5);
    expect(r.every((x) => /E minor/.test(x.piece.title + x.piece.notes))).toBe(true);
  });
  it("matches exam grades", () => {
    expect(search(index, "abrsm gr 7").length).toBeGreaterThan(20);
  });
  it("finds the Rosary set", () => {
    expect(search(index, "rosary").length).toBeGreaterThanOrEqual(15);
  });
  it("is accent-insensitive for composers", () => {
    expect(titles("dvorak romantic").length).toBeGreaterThanOrEqual(4);
  });
  it("prefix-matches the last word while typing", () => {
    expect(titles("mendelssohn conc").some((t) => t.includes("Op. 64"))).toBe(true);
  });
  it("finds a catalogue number typed without its prefix", () => {
    expect(titles("brahms 78")).toEqual(["Johannes Brahms — Sonata No. 1 in G major, Op. 78"]);
    expect(titles("mozart 216").some((t) => t.includes("K. 216"))).toBe(true);
    expect(titles("bach 1004").some((t) => t.includes("BWV 1004"))).toBe(true);
    expect(titles("brahms 7")).not.toContain("Johannes Brahms — Sonata No. 1 in G major, Op. 78");
  });
  it("doesn't require the word violin", () => {
    const r = titles("brahms violin sonata");
    for (const op of ["Op. 78", "Op. 100", "Op. 108"]) expect(r.some((t) => t.includes(op))).toBe(true);
    expect(titles("brahms sonata for violin and piano").some((t) => t.includes("Op. 78"))).toBe(true);
    expect(titles("violin").length).toBeGreaterThan(0);
  });
  it("ranks a composer's own works above works that mention him", () => {
    const r = sortPieces(search(index, "brahms violin concerto"), "relevance");
    expect(r[0].piece.title).toBe("Concerto in D major, Op. 77");
  });
});

describe("grouping", () => {
  it("groups set members and natural-sorts them", () => {
    const res = sortPieces(search(index, "rosary"), "level");
    const totals = new Map<string, number>();
    for (const p of pieces) if (p.setKey) totals.set(p.setKey, (totals.get(p.setKey) ?? 0) + 1);
    const rows = groupResults(res.map((r) => r.piece), totals);
    const set = rows.find((r) => r.kind === "set");
    expect(set && set.kind === "set" && set.pieces.length).toBeGreaterThanOrEqual(15);
    if (set && set.kind === "set") {
      const nums = set.pieces.map((p) => p.title.match(/No\. (\d+)/)?.[1]).filter(Boolean).map(Number);
      expect(nums.slice(0, 3)).toEqual([1, 2, 3]);
    }
  });
});
