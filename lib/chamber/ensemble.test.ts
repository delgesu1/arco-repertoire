import { describe, expect, it } from "vitest";
import { fitGroup, groupLabel, partTakers, withPlayers } from "./ensemble";
import type { ChamberFacts } from "./types";

type Scoring = Pick<ChamberFacts, "instruments" | "alternatives" | "optional">;
const quartet: Scoring = { instruments: { violin: 2, viola: 1, cello: 1 } };
const pianoTrio: Scoring = { instruments: { violin: 1, cello: 1, piano: 1 } };
const pianoQuartet: Scoring = { instruments: { violin: 1, viola: 1, cello: 1, piano: 1 } };
const kegelstatt: Scoring = { instruments: { clarinet: 1, viola: 1, piano: 1 }, alternatives: { clarinet: ["violin"] } };
const nachtmusik: Scoring = { instruments: { violin: 2, viola: 1, cello: 1 }, optional: { "double-bass": 1 } };
const trioSonata: Scoring = { instruments: { violin: 2, continuo: 1 } };

describe("fitGroup", () => {
  it("fits a group to a work with one player to a part", () => {
    expect(fitGroup(quartet, { violin: 2, viola: 1, cello: 1 })).toEqual({ notes: [], substitute: false });
    expect(fitGroup(pianoTrio, { piano: 1, cello: 1, violin: 1 })).toEqual({ notes: [], substitute: false });
  });

  it("leaves nobody out and needs every part", () => {
    expect(fitGroup(quartet, { violin: 2, viola: 1, cello: 1, piano: 1 })).toBeNull();
    expect(fitGroup(pianoQuartet, { violin: 1, cello: 1, piano: 1 })).toBeNull();
    expect(fitGroup(quartet, { violin: 1, viola: 2, cello: 1 })).toBeNull();
  });

  it("uses a published alternative and says so", () => {
    expect(fitGroup(kegelstatt, { violin: 1, viola: 1, piano: 1 })).toEqual({
      notes: ["violin takes the clarinet part (published alternative)"],
      substitute: false,
    });
    expect(fitGroup(kegelstatt, { clarinet: 1, viola: 1, piano: 1 })).toEqual({ notes: [], substitute: false });
  });

  it("lets an ad lib. part take an extra player, but never needs it", () => {
    expect(fitGroup(nachtmusik, { violin: 2, viola: 1, cello: 1 })).toEqual({ notes: [], substitute: false });
    expect(fitGroup(nachtmusik, { violin: 2, viola: 1, cello: 1, "double-bass": 1 })?.notes).toEqual([
      "double bass plays the ad lib. part",
    ]);
  });

  it("realises a continuo part on a keyboard, with a bass instrument doubling it or alone", () => {
    expect(fitGroup(trioSonata, { violin: 2, harpsichord: 1 })).toEqual({ notes: [], substitute: false });
    expect(fitGroup(trioSonata, { violin: 2, harpsichord: 1, cello: 1 })?.notes).toEqual(["cello doubles the continuo bass"]);
    expect(fitGroup(trioSonata, { violin: 2, harpsichord: 1, cello: 1 })?.substitute).toBe(false);
    expect(fitGroup(trioSonata, { violin: 2, piano: 1 })).toEqual({ notes: ["piano plays the continuo"], substitute: true });
    expect(fitGroup(trioSonata, { violin: 2, cello: 1 })).toEqual({
      notes: ["cello plays the continuo bass line without a keyboard"],
      substitute: true,
    });
    expect(fitGroup(trioSonata, { violin: 2, viola: 1 })).toBeNull();
  });

  it("takes a piano for a harpsichord part", () => {
    expect(fitGroup({ instruments: { violin: 1, cello: 1, harpsichord: 1 } }, pianoTrio.instruments)?.notes).toEqual([
      "piano takes the harpsichord part",
    ]);
  });

  it("does not count electronics as a player", () => {
    expect(fitGroup({ instruments: { violin: 2, viola: 1, cello: 1, electronics: 1 } }, quartet.instruments)).toEqual({ notes: [], substitute: false });
  });
});

describe("adding players", () => {
  it("names the instruments that could take a part", () => {
    expect([...partTakers(kegelstatt)].sort()).toEqual(["clarinet", "piano", "viola", "violin"]);
  });

  it("turns a piano trio into a piano quartet with a viola", () => {
    const trio = { violin: 1, cello: 1, piano: 1 };
    expect(fitGroup(pianoQuartet, withPlayers(trio, ["viola"]))).toEqual({ notes: [], substitute: false });
    expect(groupLabel(withPlayers(trio, ["violin"]))).toBe("2 violins, cello and piano");
  });
});
