import type { InstrumentKey, Instrumentation } from "./types";
import { INSTRUMENTS, SAME_INSTRUMENT_STRINGS, playersFor } from "./vocab";

export const MAX_CHAMBER_PLAYERS = 12;

/** Current catalogue scope; counts refer to independent parts, not players doubling a part. */
export function chamberScopeErrors(instruments: Instrumentation, violinId?: number): string[] {
  const errors: string[] = [];
  const keys = Object.keys(instruments) as InstrumentKey[];
  const players = playersFor(instruments);
  const sameInstrument = keys.length === 1 && SAME_INSTRUMENT_STRINGS.includes(keys[0]);
  const max = sameInstrument ? MAX_CHAMBER_PLAYERS : 9;
  if (players < 2 || players > max) errors.push(`${players} players is outside this scoring's scope (2–${max})`);
  if (players === 2 && violinId == null) errors.push("a duo must be listed in the violin section too (violinId)");
  if (!keys.some((k) => INSTRUMENTS[k].family === "string")) errors.push("no string instrument: out of scope");
  return errors;
}
