import { describe, expect, it } from "vitest";
import type { FormationKey, InstrumentKey } from "./types";
import { instrumentList, playersFor, formationFor } from "./vocab";

type Ins = Partial<Record<InstrumentKey, number>>;
const SQ: Ins = { violin: 2, viola: 1, cello: 1 };

// each scoring written out with the formation it must get
const CASES: [string, Ins, FormationKey][] = [
  ["string trio", { violin: 1, viola: 1, cello: 1 }, "string-trio"],
  ["Dvořák Terzetto (2 vn, va)", { violin: 2, viola: 1 }, "string-trio"],
  ["string quartet", SQ, "string-quartet"],
  ["Rossini sonata a quattro (2 vn, vc, db)", { violin: 2, cello: 1, "double-bass": 1 }, "string-quartet"],
  ["quartet with tape", { ...SQ, electronics: 1 }, "string-quartet"],
  ["quintet with two cellos", { violin: 2, viola: 1, cello: 2 }, "string-quintet"],
  ["sextet", { violin: 2, viola: 2, cello: 2 }, "large-strings"],
  ["octet", { violin: 4, viola: 2, cello: 2 }, "large-strings"],
  ["piano trio", { violin: 1, cello: 1, piano: 1 }, "piano-trio"],
  ["piano quartet", { violin: 1, viola: 1, cello: 1, piano: 1 }, "piano-quartet"],
  ["piano quintet", { ...SQ, piano: 1 }, "piano-quintet"],
  ["Trout scoring", { violin: 1, viola: 1, cello: 1, "double-bass": 1, piano: 1 }, "piano-quintet"],
  ["violin, viola, piano", { violin: 1, viola: 1, piano: 1 }, "piano-strings"],
  ["piano sextet", { violin: 1, viola: 2, cello: 1, "double-bass": 1, piano: 1 }, "piano-strings"],
  ["clarinet quintet", { clarinet: 1, ...SQ }, "winds-strings"],
  ["horn trio (with piano)", { horn: 1, violin: 1, piano: 1 }, "winds-strings"],
  ["Ravel Introduction et Allegro (harp and winds)", { harp: 1, flute: 1, clarinet: 1, ...SQ }, "winds-strings"],
  ["trio sonata", { violin: 2, continuo: 1 }, "continuo"],
  ["flute, violin, continuo", { flute: 1, violin: 1, continuo: 1 }, "continuo"],
  ["guitar quintet", { guitar: 1, ...SQ }, "other"],
  ["voice and string quartet", { voice: 1, ...SQ }, "other"],
];

describe("formationFor", () => {
  it.each(CASES)("%s", (_, ins, formation) => expect(formationFor(ins)).toBe(formation));
});

describe("playersFor", () => {
  it("counts continuo as one player and electronics as none", () => {
    expect(playersFor({ violin: 2, continuo: 1 })).toBe(3);
    expect(playersFor({ ...SQ, electronics: 1 })).toBe(4);
  });
});

describe("instrumentList", () => {
  it("writes counts and irregular plurals", () => {
    expect(instrumentList({ clarinet: 1, ...SQ })).toBe("clarinet, 2 violins, viola, cello");
    expect(instrumentList({ violin: 1, "double-bass": 2 })).toBe("violin, 2 double basses");
  });
});
