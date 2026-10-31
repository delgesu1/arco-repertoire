import { CHAMBER_OPTIONAL, indexWorks, search, type IndexedPiece } from "../search";
import { eraLabel } from "../vocab";
import type { ChamberPiece } from "./types";
import type { InstrumentKey } from "./types";
import { FORMATIONS, FORMS, ensembleLabel, instrumentList, playersFor, sameInstrument } from "./vocab";

/**
 * The chamber list's search index: titles with their nicknames, the other names a work goes by (`aka`: "Der Tod und das
 * Mädchen", "Forellenquintett"), and the formation, scoring and form as descriptive words ("clarinet quintet", "horn").
 */
export function indexChamber(pieces: ChamberPiece[]): IndexedPiece<ChamberPiece>[] {
  return indexWorks(
    pieces,
    (p) => {
      const c = p.chamber;
      const formation = FORMATIONS.find((f) => f.key === c.formation);
      const form = FORMS.find((f) => f.key === c.form);
      return [
        formation?.label ?? "",
        formation?.singular ?? "",
        ensembleLabel(c),
        form?.label ?? "",
        instrumentList(c.instruments, c),
        `${c.players} players`,
        eraLabel(p.era),
        p.nationality,
        c.year,
        p.mode ?? "",
        p.pace ?? "",
        ...p.character,
        p.popularity ?? "",
        p.notes,
      ];
    },
    (p) => [...(p.chamber.aka ?? []), ...(p.alsoTitled ?? [])],
  );
}

const COUNTS: Record<string, number> = { three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const GROUPS: Record<string, number> = { trio: 3, quartet: 4, quintet: 5, sextet: 6, septet: 7, octet: 8, nonet: 9 };
const INSTRUMENT = "(violin|viola|cello|violoncello|(?:double[ -])?bass)";
const COUNTED = new RegExp(`\\b(?:for )?(\\d{1,2}|${Object.keys(COUNTS).join("|")}) ${INSTRUMENT}(?:s|es)?\\b`);
const NAMED = new RegExp(`\\b${INSTRUMENT} (${Object.keys(GROUPS).join("|")})s?\\b`);
const instrumentKey = (w: string): InstrumentKey => (w.includes("bass") ? "double-bass" : w === "violoncello" ? "cello" : (w as InstrumentKey));

/** A same-instrument scoring in a query: "4 cellos", "for eight violins", "cello quartet", with any other words left over. */
export function parseScoring(q: string): { instrument: InstrumentKey; parts: number; named: boolean; rest: string } | null {
  const text = q.toLowerCase().replace(/\s+/g, " ").trim();
  const counted = COUNTED.exec(text);
  const named = counted ? null : NAMED.exec(text);
  const m = counted ?? named;
  if (!m) return null;
  const parts = counted ? (COUNTS[counted[1]] ?? Number(counted[1])) : GROUPS[named![2]];
  if (parts < 3 || parts > 12) return null;
  return { instrument: instrumentKey(counted ? counted[2] : named![1]), parts, named: !counted, rest: text.replace(m[0], " ").trim() };
}

const EXACT_FIRST = 1e6;

/**
 * Searches the chamber list: unlike the violin list, "violin" is a word a work must match. A same-instrument scoring means
 * that scoring. "4 cellos" lists only the works for four cellos. "Cello quartet" lists them first and keeps the other
 * matches, because the words have other meanings: a "cello quintet" is also Schubert's, for string quartet and a second cello.
 */
export function searchChamber(index: IndexedPiece<ChamberPiece>[], q: string) {
  const plain = () => search(index, q, CHAMBER_OPTIONAL);
  const scoring = parseScoring(q);
  if (!scoring) return plain();
  const exact = index.filter(
    ({ piece: { chamber: c } }) => sameInstrument(c.instruments) === scoring.instrument && playersFor(c.instruments) === scoring.parts,
  );
  const found = scoring.rest ? search(exact, scoring.rest, CHAMBER_OPTIONAL) : exact.map((ix) => ({ piece: ix.piece, score: 0 }));
  if (!found.length) return plain();
  const first = found.map((r) => ({ piece: r.piece, score: r.score + EXACT_FIRST }));
  if (!scoring.named) return first;
  const ids = new Set(first.map((r) => r.piece.id));
  return [...first, ...plain().filter((r) => !ids.has(r.piece.id))];
}
