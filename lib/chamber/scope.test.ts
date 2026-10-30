import { describe, expect, it } from "vitest";
import { chamberScopeErrors } from "./scope";
import type { InstrumentKey } from "./types";

describe("chamber catalogue scope", () => {
  it.each<InstrumentKey>(["violin", "viola", "cello", "double-bass"])("accepts 3–12 independent %s parts", (instrument) => {
    for (let count = 3; count <= 12; count++) expect(chamberScopeErrors({ [instrument]: count })).toEqual([]);
    expect(chamberScopeErrors({ [instrument]: 13 })).not.toEqual([]);
  });

  it("preserves the nine-part limit for mixed ensembles and viol consorts", () => {
    expect(chamberScopeErrors({ violin: 4, viola: 2, cello: 2, "double-bass": 1 })).toEqual([]);
    expect(chamberScopeErrors({ violin: 4, viola: 2, cello: 3, "double-bass": 1 })).not.toEqual([]);
    expect(chamberScopeErrors({ "viola-da-gamba": 10 })).not.toEqual([]);
    expect(chamberScopeErrors({ cello: 10, piano: 1 })).not.toEqual([]);
    expect(chamberScopeErrors({ violin: 10, electronics: 1 })).not.toEqual([]);
  });

  it("preserves the string requirement and existing cross-listed duo rule", () => {
    expect(chamberScopeErrors({ flute: 3 })).toContain("no string instrument: out of scope");
    expect(chamberScopeErrors({ cello: 1 })).not.toEqual([]);
    expect(chamberScopeErrors({ violin: 2 })).not.toEqual([]);
    expect(chamberScopeErrors({ violin: 2 }, 430)).toEqual([]);
    expect(chamberScopeErrors({})).not.toEqual([]);
  });
});
