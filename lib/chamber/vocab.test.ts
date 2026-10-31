import { describe, expect, it } from "vitest";
import type { FormKey, FormationKey, InstrumentKey, Instrumentation } from "./types";
import {
  FORMATIONS,
  FORMATION_GROUPS,
  FORMS,
  chamberHeading,
  chamberSentence,
  ensembleLabel,
  formationFor,
  instrumentList,
  instrumentParts,
  instrumentsByUse,
  playableBy,
  playersFor,
} from "./vocab";

type Ins = Partial<Record<InstrumentKey, number>>;
const SQ: Ins = { violin: 2, viola: 1, cello: 1 };

// each scoring written out with the formation it must get
const CASES: [string, Ins, FormationKey][] = [
  ["violin sonata", { violin: 1, piano: 1 }, "duo-piano"],
  ["Bach's obbligato sonatas (violin, harpsichord)", { violin: 1, harpsichord: 1 }, "duo-piano"],
  ["two violins", { violin: 2 }, "duo-strings"],
  ["violin and cello (Ravel)", { violin: 1, cello: 1 }, "duo-strings"],
  ["violin and guitar (Paganini)", { violin: 1, guitar: 1 }, "duo-other"],
  ["violin, piano and tape (electronics are not a player)", { violin: 1, piano: 1, electronics: 1 }, "duo-piano"],
  ["string trio", { violin: 1, viola: 1, cello: 1 }, "string-trio"],
  ["Dvořák Terzetto (2 vn, va)", { violin: 2, viola: 1 }, "string-trio"],
  ["string quartet", SQ, "string-quartet"],
  ["three violins", { violin: 3 }, "same-instrument"],
  ["four cellos", { cello: 4 }, "same-instrument"],
  ["four double basses", { "double-bass": 4 }, "same-instrument"],
  ["eight violas", { viola: 8 }, "same-instrument"],
  ["twelve cellos", { cello: 12 }, "same-instrument"],
  ["four violins with tape", { violin: 4, electronics: 1 }, "same-instrument"],
  ["two violins stay a duo", { violin: 2 }, "duo-strings"],
  ["three cellos and piano", { cello: 3, piano: 1 }, "piano-strings"],
  ["Rossini sonata a quattro (2 vn, vc, db)", { violin: 2, cello: 1, "double-bass": 1 }, "string-quartet"],
  ["quartet with tape", { ...SQ, electronics: 1 }, "string-quartet"],
  ["quintet with two cellos", { violin: 2, viola: 1, cello: 2 }, "string-quintet"],
  ["sextet", { violin: 2, viola: 2, cello: 2 }, "large-strings"],
  ["octet", { violin: 4, viola: 2, cello: 2 }, "large-strings"],
  ["viol consort (Purcell's fantazias a 4)", { "viola-da-gamba": 4 }, "viol-consort"],
  ["viols and organ (Jenkins)", { "viola-da-gamba": 3, organ: 1 }, "viol-consort"],
  ["violins with a bass viol and organ (a fantasia-suite)", { violin: 2, "viola-da-gamba": 1, organ: 1 }, "other"],
  ["two viols and continuo (a sonata)", { "viola-da-gamba": 2, continuo: 1 }, "continuo"],
  ["consort song (voice and viols)", { voice: 1, "viola-da-gamba": 4 }, "other"],
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
  it("writes alternatives and ad lib. parts", () => {
    expect(instrumentList({ clarinet: 1, viola: 1, piano: 1 }, { alternatives: { clarinet: ["violin"] } })).toBe(
      "clarinet (or violin), viola, piano",
    );
    expect(instrumentList({ horn: 1, violin: 1, piano: 1 }, { alternatives: { horn: ["viola", "cello"] } })).toBe(
      "horn (or viola or cello), violin, piano",
    );
    expect(instrumentList(SQ, { optional: { "double-bass": 1 } })).toBe("2 violins, viola, cello, double bass ad lib.");
  });
});

describe("playableBy", () => {
  it("includes alternatives and ad lib. parts", () => {
    const kegelstatt = { instruments: { clarinet: 1, viola: 1, piano: 1 }, alternatives: { clarinet: ["violin" as const] } };
    expect([...playableBy(kegelstatt)].sort()).toEqual(["clarinet", "piano", "viola", "violin"]);
    expect(playableBy({ instruments: SQ, optional: { "double-bass": 1 } }).has("double-bass")).toBe(true);
  });
});

// the finder's wording is written out here on purpose, not derived from the code under test
const FORM_WORDS: Record<FormKey, string> = {
  work: "full works",
  short: "short pieces",
  set: "sets of pieces",
};
const FORMATION_WORDS: Record<FormationKey, string> = {
  "duo-piano": "for violin & piano",
  "duo-strings": "for string duo",
  "duo-other": "for violin & guitar or harp",
  "string-trio": "for string trio",
  "string-quartet": "for string quartet",
  "string-quintet": "for string quintet",
  "large-strings": "for string sextet or larger",
  "same-instrument": "for same-instrument ensemble",
  "viol-consort": "for viol consort",
  "piano-trio": "for piano trio",
  "piano-quartet": "for piano quartet",
  "piano-quintet": "for piano quintet",
  "piano-strings": "for piano & strings",
  "winds-strings": "for strings & winds",
  continuo: "with continuo",
  other: "for other ensembles",
};
const LEVELS: { level: number | null; exact: boolean; words: string }[] = [
  { level: null, exact: false, words: "at any level" },
  { level: 3, exact: true, words: "at level 3" },
  { level: 3, exact: false, words: "around level 3" },
];

describe("chamber finder sentence", () => {
  it("has wording for every form and formation in the vocabulary", () => {
    expect(FORMS.map((f) => f.key).sort()).toEqual(Object.keys(FORM_WORDS).sort());
    expect(FORMATIONS.map((f) => f.key).sort()).toEqual(Object.keys(FORMATION_WORDS).sort());
  });
  it("reads as in the mockup", () => {
    expect(chamberSentence("short", "string-quartet", 3, false)).toBe("Show me short pieces for string quartet around level 3");
  });

  const forms: (FormKey | null)[] = [null, ...FORMS.map((f) => f.key)];
  const formations: (FormationKey | null)[] = [null, ...FORMATIONS.map((f) => f.key)];
  for (const form of forms) {
    for (const formation of formations) {
      for (const lv of LEVELS) {
        const want = `Show me ${form ? FORM_WORDS[form] : "any piece"} ${formation ? FORMATION_WORDS[formation] : "for any ensemble"} ${lv.words}`;
        it(want, () => {
          expect(chamberSentence(form, formation, lv.level, lv.exact)).toBe(want);
        });
      }
    }
  }
});

describe("chamber results heading", () => {
  it("uses the same wording as the sentence", () => {
    expect(chamberHeading(null, null)).toBe("");
    expect(chamberHeading("short", null)).toBe("Short pieces");
    expect(chamberHeading(null, "continuo")).toBe("Pieces with continuo");
    expect(chamberHeading(null, "piano-trio")).toBe("Pieces for piano trio");
    expect(chamberHeading("work", "winds-strings")).toBe("Full works for strings & winds");
    expect(chamberHeading("set", "large-strings")).toBe("Sets of pieces for string sextet or larger");
  });
});

describe("the ensemble menu", () => {
  it("lists every formation once, under a heading", () => {
    const keys = FORMATION_GROUPS.flatMap((g) => g.keys);
    expect([...keys].sort()).toEqual(FORMATIONS.map((f) => f.key).sort());
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("instrumentParts", () => {
  it("keeps alternatives and ad lib. apart so the row can set them off", () => {
    expect(instrumentParts({ clarinet: 1, viola: 1, piano: 1 }, { alternatives: { clarinet: ["violin"] } })).toEqual([
      { name: "clarinet", note: "(or violin)" },
      { name: "viola" },
      { name: "piano" },
    ]);
    expect(instrumentParts(SQ, { optional: { "double-bass": 1 } }).at(-1)).toEqual({ name: "double bass", note: "ad lib." });
  });
});

describe("instrumentsByUse", () => {
  it("orders the includes chips by use and leaves electronics out", () => {
    const works: { instruments: Ins; alternatives?: Partial<Record<InstrumentKey, InstrumentKey[]>>; optional?: Ins }[] = [
      { instruments: { clarinet: 1, viola: 1, piano: 1 }, alternatives: { clarinet: ["violin"] } },
      { instruments: { horn: 1, violin: 1, piano: 1 }, alternatives: { horn: ["viola", "cello"] } },
      { instruments: SQ, optional: { "double-bass": 1 } },
      { instruments: { ...SQ, electronics: 1 } },
    ];
    const order = instrumentsByUse(works.map((chamber) => ({ chamber })));
    expect(order[0]).toEqual({ key: "violin", works: 4 });
    expect(order.map((x) => x.key)).not.toContain("electronics");
    // a tie keeps the vocabulary's order: viola before cello before piano
    expect(order.slice(1, 4).map((x) => x.key)).toEqual(["viola", "cello", "piano"]);
  });
});

describe("ensembleLabel", () => {
  const label = (instruments: Instrumentation) => ensembleLabel({ formation: formationFor(instruments), instruments });
  it("names a same-instrument ensemble by its instrument and size", () => {
    expect(label({ violin: 3 })).toBe("Violin trio");
    expect(label({ cello: 4 })).toBe("Cello quartet");
    expect(label({ "double-bass": 4 })).toBe("Double bass quartet");
    expect(label({ viola: 8 })).toBe("Viola octet");
    expect(label({ cello: 12 })).toBe("Cello ensemble");
  });
  it("keeps the formation's name for everything else", () => {
    expect(label({ violin: 2, viola: 1, cello: 1 })).toBe("String quartet");
    expect(label({ violin: 2, viola: 2, cello: 2 })).toBe("String sextet or larger");
  });
});
