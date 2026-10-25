import type { ChamberFacts, InstrumentKey, Instrumentation } from "./types";
import { INSTRUMENTS } from "./vocab";

/**
 * "What can our group play?" for the chamber advisor: whether a group of players (instrument → how many) can play a work,
 * one player to a part, with nobody left out. A part can be taken by its own instrument, by a published alternative
 * (Kegelstatt: violin for the clarinet), or by a usual substitute (a piano for a harpsichord part, a keyboard or lute for
 * the continuo, a cello playing the continuo bass line alone). Ad lib. parts and a doubling of the continuo bass take extra
 * players but are never needed.
 */
export type Group = Instrumentation;

/** the bass instruments that join a keyboard on a continuo part (and can play its bass line alone, without chords) */
const CONTINUO_BASS: InstrumentKey[] = ["cello", "viola-da-gamba", "double-bass", "bassoon"];

const label = (k: InstrumentKey) => INSTRUMENTS[k].label;

interface Option {
  k: InstrumentKey;
  note?: string;
  cost: number; // the fit with the lowest total wins: 0 the score's own choice, 1 a published alternative, SUB and up a substitute
}
/** any fit with a substitute costs more than every fit without one */
const SUB = 10;

/** usual substitutes for a part, beyond the work's own published alternatives; a fit using one says so */
function substitutes(part: InstrumentKey): Option[] {
  if (part === "continuo")
    return [
      // a harpsichord or an organ is how a continuo part is usually played: no note needed
      { k: "harpsichord", cost: 0 },
      { k: "organ", cost: 0 },
      { k: "piano", cost: SUB, note: "piano plays the continuo" },
      { k: "lute", cost: SUB, note: "lute plays the continuo" },
      ...CONTINUO_BASS.map((k) => ({ k, cost: SUB + 3, note: `${label(k)} plays the continuo bass line without a keyboard` })),
    ];
  const by: Partial<Record<InstrumentKey, InstrumentKey[]>> = {
    harpsichord: ["piano"],
    organ: ["harpsichord", "piano"],
    harmonium: ["piano", "organ"],
    celesta: ["piano"],
  };
  return (by[part] ?? []).map((k) => ({ k, cost: SUB + 1, note: `${label(k)} takes the ${label(part)} part` }));
}
interface Slot {
  options: Option[];
  required: boolean;
}

function slotsFor(c: Pick<ChamberFacts, "instruments" | "alternatives" | "optional">): Slot[] {
  const slots: Slot[] = [];
  const partOptions = (k: InstrumentKey): Option[] => {
    const alt = c.alternatives?.[k] ?? [];
    return [
      { k, cost: 0 },
      ...alt.map((a) => ({ k: a, cost: 1, note: `${label(a)} takes the ${label(k)} part (published alternative)` })),
      ...substitutes(k).filter((o) => o.k !== k && !alt.includes(o.k)),
    ];
  };
  for (const [k, n] of Object.entries(c.instruments) as [InstrumentKey, number][]) {
    if (INSTRUMENTS[k].family === "electronics") continue;
    for (let i = 0; i < n; i++) slots.push({ options: partOptions(k), required: true });
  }
  for (const [k, n] of Object.entries(c.optional ?? {}) as [InstrumentKey, number][])
    for (let i = 0; i < n; i++)
      slots.push({ options: partOptions(k).map((o) => ({ ...o, note: o.note ?? `${label(k)} plays the ad lib. part` })), required: false });
  // an extra bass player may double the continuo bass line beside the keyboard
  if (c.instruments.continuo)
    for (let i = 0; i < 2; i++)
      slots.push({
        options: CONTINUO_BASS.map((k) => ({ k, cost: 0, note: `${label(k)} doubles the continuo bass` })),
        required: false,
      });
  // the fewest choices first keeps the search small
  return slots.sort((a, b) => Number(b.required) - Number(a.required) || a.options.length - b.options.length);
}

export interface Fit {
  /** how the group covers the parts when that differs from the score's own instruments (empty: a plain fit) */
  notes: string[];
  /** whether the fit needs a substitute the score does not name (a piano for the continuo, a cello without a keyboard …) */
  substitute: boolean;
}

/** Whether `group` plays the work with one player to each part and nobody left over; the fit with the fewest substitutions. */
export function fitGroup(c: Pick<ChamberFacts, "instruments" | "alternatives" | "optional">, group: Group): Fit | null {
  const slots = slotsFor(c);
  const left = new Map<InstrumentKey, number>();
  let total = 0;
  for (const [k, n] of Object.entries(group) as [InstrumentKey, number][])
    if (n > 0) {
      left.set(k, n);
      total += n;
    }
  const required = slots.filter((s) => s.required).length;
  if (total < required || total > slots.length) return null;

  let best: { cost: number; notes: string[] } | null = null;
  const notes: string[] = [];
  const walk = (i: number, remaining: number, cost: number) => {
    if (best && cost >= best.cost) return;
    // required slots come first: the players left must cover the required ones still open and fit in the slots left
    if (remaining < required - i || remaining > slots.length - i) return;
    if (remaining === 0) {
      // every player has a part; the rest must be optional
      if (slots.slice(i).every((s) => !s.required)) best = { cost, notes: [...notes] };
      return;
    }
    if (i === slots.length) return;
    const s = slots[i];
    for (const o of s.options) {
      const n = left.get(o.k) ?? 0;
      if (!n) continue;
      left.set(o.k, n - 1);
      if (o.note) notes.push(o.note);
      walk(i + 1, remaining - 1, cost + o.cost);
      if (o.note) notes.pop();
      left.set(o.k, n);
    }
    if (!s.required) walk(i + 1, remaining, cost);
  };
  walk(0, total, 0);
  const found = best as { cost: number; notes: string[] } | null;
  return found ? { notes: [...new Set(found.notes)], substitute: found.cost >= SUB } : null;
}

/** the instruments that could take some part of the work (the candidates for "add one player") */
export function partTakers(c: Pick<ChamberFacts, "instruments" | "alternatives" | "optional">): Set<InstrumentKey> {
  return new Set(slotsFor(c).flatMap((s) => s.options.map((o) => o.k)));
}

/** the group with `extra` players added */
export function withPlayers(group: Group, extra: InstrumentKey[]): Group {
  const g: Group = { ...group };
  for (const k of extra) g[k] = (g[k] ?? 0) + 1;
  return g;
}

/** "violin, viola, cello and piano", "2 violins and continuo" */
export function groupLabel(group: Group): string {
  const parts = (Object.entries(group) as [InstrumentKey, number][])
    .filter(([, n]) => n > 0)
    .map(([k, n]) => (n > 1 ? `${n} ${INSTRUMENTS[k].plural ?? `${label(k)}s`}` : label(k)));
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}` : (parts[0] ?? "nobody");
}
