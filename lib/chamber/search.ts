import { CHAMBER_OPTIONAL, indexWorks, search, type IndexedPiece } from "../search";
import { eraLabel } from "../vocab";
import type { ChamberPiece } from "./types";
import { FORMATIONS, FORMS, ensembleLabel, instrumentList } from "./vocab";

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

/** Searches the chamber list: unlike the violin list, "violin" is a word a work must match. */
export const searchChamber = (index: IndexedPiece<ChamberPiece>[], q: string) => search(index, q, CHAMBER_OPTIONAL);
