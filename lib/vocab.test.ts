import { describe, expect, it } from "vitest";
import type { SettingKey, TypeKey } from "./types";
import { SETTINGS, TYPES, finderSentence, resultsHeading } from "./vocab";

// the wording is written out here on purpose, not derived from the code under test
const TYPE_WORDS: Record<TypeKey, string> = {
  concerto: "concertos",
  sonata: "sonatas & duos",
  short: "short pieces",
  showpiece: "showpieces",
  concertpiece: "concert pieces",
  suite: "suites & sets",
  solo: "solo works",
  duet: "duets & doubles",
  etude: "études & caprices",
  technique: "technique",
};
const SETTING_WORDS: Record<SettingKey, string> = {
  solo: "for solo violin",
  piano: "with piano",
  orchestra: "with orchestra",
  duo: "for two or more violins",
  continuo: "with continuo",
  other: "for other ensembles",
};
const LEVELS: { level: number | null; exact: boolean; words: string }[] = [
  { level: null, exact: false, words: "at any level" },
  { level: 5, exact: true, words: "at level 5" },
  { level: 5, exact: false, words: "around level 5" },
];

describe("finder sentence", () => {
  it("has wording for every type and setting in the vocabulary", () => {
    expect(TYPES.map((t) => t.key).sort()).toEqual(Object.keys(TYPE_WORDS).sort());
    expect(SETTINGS.map((s) => s.key).sort()).toEqual(Object.keys(SETTING_WORDS).sort());
  });

  const types: (TypeKey | null)[] = [null, ...TYPES.map((t) => t.key)];
  const settings: (SettingKey | null)[] = [null, ...SETTINGS.map((s) => s.key)];
  for (const type of types) {
    for (const setting of settings) {
      for (const lv of LEVELS) {
        const want = `Show me ${type ? TYPE_WORDS[type] : "any piece"} ${setting ? SETTING_WORDS[setting] : "in any setting"} ${lv.words}`;
        it(want, () => {
          expect(finderSentence(type, setting, lv.level, lv.exact)).toBe(want);
        });
      }
    }
  }
});

describe("results heading", () => {
  it("uses the same wording as the sentence", () => {
    expect(resultsHeading(null, null)).toBe("");
    expect(resultsHeading("concerto", null)).toBe("Concertos");
    expect(resultsHeading(null, "continuo")).toBe("Pieces with continuo");
    expect(resultsHeading(null, "solo")).toBe("Pieces for solo violin");
    expect(resultsHeading("sonata", "piano")).toBe("Sonatas & duos with piano");
    expect(resultsHeading("etude", "duo")).toBe("Études & caprices for two or more violins");
    expect(resultsHeading("suite", "other")).toBe("Suites & sets for other ensembles");
  });
});
