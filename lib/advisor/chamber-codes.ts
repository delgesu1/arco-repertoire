import type { ChamberFacts, FormKey, HardestPart, InstrumentKey } from "../chamber/types";
import { INSTRUMENTS } from "../chamber/vocab";

/**
 * Short instrument codes for the chamber advisor's catalogue lines (scripts/build-chamber.ts writes them, lib/advisor/
 * chamber-prompt.ts explains them): "2vn va vc", "cl/vn va pf" (clarinet or violin), "2vn va vc db?" (double bass ad lib.).
 */
export const INSTRUMENT_CODES: Record<InstrumentKey, string> = {
  violin: "vn",
  viola: "va",
  cello: "vc",
  "double-bass": "db",
  "viola-da-gamba": "gb",
  "viola-damore": "vda",
  piano: "pf",
  harpsichord: "hpd",
  organ: "org",
  harmonium: "hrm",
  celesta: "cel",
  continuo: "bc",
  flute: "fl",
  recorder: "rec",
  oboe: "ob",
  "english-horn": "eh",
  clarinet: "cl",
  "bass-clarinet": "bcl",
  "basset-horn": "bth",
  bassoon: "bn",
  saxophone: "sax",
  horn: "hn",
  trumpet: "tp",
  trombone: "tb",
  tuba: "tu",
  harp: "hp",
  guitar: "gt",
  lute: "lt",
  mandolin: "md",
  accordion: "acc",
  percussion: "perc",
  voice: "v",
  electronics: "el",
};

export const FORM_CODES: Record<FormKey, string> = { work: "", short: "s", set: "c" };

/** "vn vn va vc" → "2vn va vc"; alternatives after a slash, ad lib. parts with "?" */
export function scoringCode(c: Pick<ChamberFacts, "instruments" | "alternatives" | "optional">): string {
  const one = (k: InstrumentKey, n: number, suffix = "") =>
    `${n > 1 ? n : ""}${[INSTRUMENT_CODES[k], ...(c.alternatives?.[k] ?? []).map((a) => INSTRUMENT_CODES[a])].join("/")}${suffix}`;
  return [
    ...(Object.entries(c.instruments) as [InstrumentKey, number][]).map(([k, n]) => one(k, n)),
    ...(Object.entries(c.optional ?? {}) as [InstrumentKey, number][]).map(([k, n]) => one(k, n, "?")),
  ].join(" ");
}

/** "violin 1" → "vn1", "piano" → "pf", "balanced" → "bal" (an unknown name stays as it is) */
export function hardestCode(h: HardestPart): string {
  if (h === "balanced") return "bal";
  const m = h.match(/^(.+?)(?: (\d+))?$/);
  const name = m?.[1] ?? h;
  const key = (Object.keys(INSTRUMENTS) as InstrumentKey[]).find((k) => k === name || INSTRUMENTS[k].label === name);
  return key ? `${INSTRUMENT_CODES[key]}${m?.[2] ?? ""}` : h;
}

/** the legend for the prompt: "vn violin · va viola · …" */
export const codeLegend = () =>
  (Object.entries(INSTRUMENT_CODES) as [InstrumentKey, string][]).map(([k, code]) => `${code} ${INSTRUMENTS[k].label}`).join(" · ");
